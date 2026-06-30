# -*- coding: utf-8 -*-
__title__ = "Update\nTendon"
__doc__ = "Select generated tendons (DirectShapes or FamilyInstances), edit their individual parameters in the properties palette, and run this to update their 3D shapes."

import os
import math
from pyrevit import forms, script
from Autodesk.Revit.DB import *
from Autodesk.Revit.UI.Selection import ObjectType

doc = __revit__.ActiveUIDocument.Document
uidoc = __revit__.ActiveUIDocument

METERS_TO_FEET = 3.28084
MM_TO_FEET = 0.00328084

def get_param_value(elem, name, p_type, default=0.0):
    try:
        p = elem.LookupParameter(name)
        if p and p.HasValue:
            if p.StorageType == StorageType.String:
                import re
                val_str = p.AsString()
                numbers = re.findall(r"[-+]?\d*\.\d+|\d+", val_str)
                if numbers:
                    return float(numbers[0])
            elif p.StorageType == StorageType.Double:
                if p_type == "length":
                    return p.AsDouble() * 304.8
                else:
                    return p.AsDouble()
    except Exception:
        pass
    return default

def set_param_value(elem, name, value, p_type):
    try:
        p = elem.LookupParameter(name)
        if p:
            if p.StorageType == StorageType.String:
                if p_type == "length":
                    p.Set("{} mm".format(value))
                else:
                    p.Set(str(value))
            elif p.StorageType == StorageType.Double:
                if p_type == "length":
                    p.Set(float(value) / 304.8)
                else:
                    p.Set(float(value))
            else:
                p.Set(str(value))
    except Exception:
        pass

def evaluate_tendon_y(x_global, span_lengths, supports, low_points, inflection_ratio):
    accum_x = 0.0
    span_idx = -1
    local_x = 0.0
    
    for idx, L in enumerate(span_lengths):
        if accum_x <= x_global <= (accum_x + L + 0.0001):
            span_idx = idx
            local_x = x_global - accum_x
            break
        accum_x += L
        
    if span_idx == -1:
        span_idx = len(span_lengths) - 1
        local_x = span_lengths[span_idx]
        
    L = span_lengths[span_idx]
    yL = supports[span_idx] if span_idx < len(supports) else supports[-1]
    yR = supports[span_idx + 1] if (span_idx + 1) < len(supports) else supports[-1]
    
    lp = low_points[span_idx]
    xm = lp.get('xFract', 0.5) * L
    ym = lp.get('y', 25.0)
    a = inflection_ratio
    
    if local_x <= xm:
        X1 = xm
        Y1 = yL - ym
        b1 = max(0.05, min(0.95, (a * L) / X1))
        x_inf = b1 * X1
        a1_low = Y1 / ((1.0 - b1) * X1 * X1)
        a1_supp = Y1 / (b1 * X1 * X1)
        
        if local_x >= x_inf:
            return ym + a1_low * (xm - local_x) * (xm - local_x)
        else:
            return yL - a1_supp * local_x * local_x
    else:
        X2 = L - xm
        Y2 = yR - ym
        b2 = max(0.05, min(0.95, (a * L) / X2))
        x_inf = L - b2 * X2
        a2_low = Y2 / ((1.0 - b2) * X2 * X2)
        a2_supp = Y2 / (b2 * X2 * X2)
        
        if local_x <= x_inf:
            return ym + a2_low * (local_x - xm) * (local_x - xm)
        else:
            return yR - a2_supp * (L - local_x) * (L - local_x)

def create_swept_solid(path, radius):
    deriv = path.ComputeDerivatives(0.0, True)
    pt = deriv.Origin
    tangent = deriv.BasisX.Normalize()
    
    if abs(tangent.Z) < 0.999:
        u = tangent.CrossProduct(XYZ.BasisZ).Normalize()
    else:
        u = tangent.CrossProduct(XYZ.BasisX).Normalize()
    v = tangent.CrossProduct(u).Normalize()
    
    arc1 = Arc.Create(pt, radius, 0, math.pi, u, v)
    arc2 = Arc.Create(pt, radius, math.pi, 2 * math.pi, u, v)
    
    profile_loop = CurveLoop()
    profile_loop.Append(arc1)
    profile_loop.Append(arc2)
    
    profile_list = [profile_loop]
    sweep_path_loop = CurveLoop()
    sweep_path_loop.Append(path)
    
    return GeometryCreationUtilities.CreateSweptGeometry(
        sweep_path_loop,
        0,
        0.0,
        profile_list
    )

# --- Execution ---
selection_ids = uidoc.Selection.GetElementIds()
selected_elements = []

for s_id in selection_ids:
    elem = doc.GetElement(s_id)
    line_param = elem.LookupParameter("TF_LineID")
    slab_param = elem.LookupParameter("TF_SlabID")
    if line_param and slab_param and line_param.AsString():
        selected_elements.append(elem)

# Prompt selection if empty
if not selected_elements:
    try:
        selection_refs = uidoc.Selection.PickObjects(
            ObjectType.Element, 
            "Select one or more TendonFlow model elements (DirectShapes or Families) to update"
        )
        for ref in selection_refs:
            elem = doc.GetElement(ref)
            line_param = elem.LookupParameter("TF_LineID")
            if line_param and line_param.AsString():
                selected_elements.append(elem)
    except Exception:
        forms.alert("Selection cancelled.", title="Cancelled")
        script.exit()

if not selected_elements:
    forms.alert("No valid TendonFlow elements selected.", title="Error")
    script.exit()

success_count = 0
error_messages = []

for ds in selected_elements:
    line_id_str = ds.LookupParameter("TF_LineID").AsString()
    slab_id_str = ds.LookupParameter("TF_SlabID").AsString()
    
    line_elem = doc.GetElement(line_id_str)
    slab_elem = doc.GetElement(slab_id_str)
    
    if not line_elem or not slab_elem:
        error_messages.append("Element {}: Layout Line or Slab has been deleted.".format(ds.Id))
        continue
        
    geom_curve = None
    if hasattr(line_elem, "GeometryCurve"):
        geom_curve = line_elem.GeometryCurve
    elif isinstance(line_elem, CurveElement):
        geom_curve = line_elem.GeometryCurve
        
    if not geom_curve:
        error_messages.append("Element {}: Layout line does not contain valid geometry.".format(ds.Id))
        continue
        
    # Read parameters
    force = get_param_value(ds, "TF_TendonForce", "number", 1400.0)
    duct_diameter = get_param_value(ds, "TF_DuctDiameter", "length", 25.0)
    cover_top = get_param_value(ds, "TF_CoverTop", "length", 25.0)
    cover_bottom = get_param_value(ds, "TF_CoverBottom", "length", 25.0)
    inflection_ratio = get_param_value(ds, "TF_InflectionRatio", "number", 0.1)
    
    supports = []
    for i in range(4):
        val = get_param_value(ds, "TF_Support_{}".format(i), "length", -1.0)
        if val >= 0.0:
            supports.append(val)
            
    low_points = []
    for i in range(1, 4):
        val = get_param_value(ds, "TF_LowPoint_{}".format(i), "length", -1.0)
        if val >= 0.0:
            low_points.append({"y": val, "xFract": 0.5})
            
    if len(supports) < 2 or not low_points:
        error_messages.append("Element {}: Invalid support/low point values in parameters.".format(ds.Id))
        continue
        
    # Slab Bounds
    bbox = slab_elem.get_BoundingBox(None)
    slab_bottom_z_ft = bbox.Min.Z
    slab_top_z_ft = bbox.Max.Z
    slab_thickness_mm = (slab_top_z_ft - slab_bottom_z_ft) * 304.8
    
    curve_len_meters = geom_curve.Length / METERS_TO_FEET
    
    # Read span lengths
    param_span_lengths = []
    for i in range(1, 4):
        val = get_param_value(ds, "TF_SpanLength_{}".format(i), "length", -1.0)
        if val > 0.0:
            param_span_lengths.append(val / 1000.0)
            
    num_spans = len(supports) - 1
    if len(param_span_lengths) == num_spans:
        total_design_len = sum(param_span_lengths)
        scale = curve_len_meters / total_design_len if total_design_len > 0.0 else 1.0
        span_lengths = [L * scale for L in param_span_lengths]
    else:
        if num_spans == 1:
            span_lengths = [curve_len_meters]
        elif num_spans == 2:
            span_lengths = [curve_len_meters * 0.5, curve_len_meters * 0.5]
        elif num_spans == 3:
            span_lengths = [curve_len_meters * 0.33, curve_len_meters * 0.34, curve_len_meters * 0.33]
        else:
            span_lengths = [curve_len_meters / float(num_spans)] * num_spans
        
    total_design_len = sum(span_lengths)
    
    # 3. Regenerate 3D Points along curve path
    xyz_points = []
    num_steps = 100
    
    pt_start = geom_curve.GetEndPoint(0)
    pt_end = geom_curve.GetEndPoint(1)
    reverse_eval = False
    if abs(pt_start.X - pt_end.X) > 0.001:
        if pt_start.X > pt_end.X:
            reverse_eval = True
    else:
        if pt_start.Y > pt_end.Y:
            reverse_eval = True

    for step in range(num_steps + 1):
        t = step / float(num_steps)
        t_eval = (1.0 - t) if reverse_eval else t
        pt = geom_curve.Evaluate(t_eval, True)
        
        x_m = t * curve_len_meters
        x_design = x_m * (total_design_len / curve_len_meters)
        
        z_mm = evaluate_tendon_y(x_design, span_lengths, supports, low_points, inflection_ratio)
        z_ft = z_mm * MM_TO_FEET
        z_global_ft = slab_bottom_z_ft + z_ft
        xyz_points.append(XYZ(pt.X, pt.Y, z_global_ft))
        
    draped_curve = HermiteSpline.Create(xyz_points, False)
    radius_ft = (duct_diameter / 2.0) * MM_TO_FEET
    new_duct_solid = create_swept_solid(draped_curve, radius_ft)
    
    # --- Update geometry in Revit ---
    t_trans = Transaction(doc, "Update Tendon Geometry")
    t_trans.Start()
    try:
        ds.SetShape([new_duct_solid])
        set_param_value(ds, "TF_SlabThickness", slab_thickness_mm, "length")
        t_trans.Commit()
        success_count += 1
    except Exception as ex:
        t_trans.RollBack()
        error_messages.append("Element {}: {}".format(ds.Id, ex))

# Display Results
if success_count > 0:
    msg = "Successfully updated {} tendon(s) geometry in Revit!".format(success_count)
    if error_messages:
        msg += "\n\nWarnings:\n" + "\n".join(error_messages)
    forms.alert(msg, title="Update Complete")
else:
    forms.alert("No tendons could be updated:\n\n" + "\n".join(error_messages), title="Error")
