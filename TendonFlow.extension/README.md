# TendonFlow Revit Add-in (pyRevit Extension)

This extension allows you to model 3D post-tensioned tendon swept ducts directly inside Autodesk Revit slabs from the TendonFlow Web Designer.

## 🚀 Installation Instructions

1. Ensure you have **pyRevit** installed in Autodesk Revit. If not, download and install it from [eirannejad/pyRevit](https://github.com/eirannejad/pyRevit/releases).
2. Copy this folder (`TendonFlow.extension`) into your local pyRevit Extensions folder:
   * *Typical Path:* `C:\Users\<YourUsername>\AppData\Roaming\pyRevit\Extensions\`
3. Open Autodesk Revit, go to the **pyRevit** tab on the ribbon, and click **Reload**.
4. A new **TendonFlow** tab will appear on your ribbon containing the commands.

## 📖 Step-by-Step Workflows

### Workflow A: Batch Import (Recommended)
1. Model your concrete slab and draw plan detail/model lines for the tendon paths in Revit.
2. Design your tendon elevations in the [TendonFlow Web Designer](https://pradul-p.github.io/PT/).
3. Click **Save Design** on the website to download your `.json` design file.
4. In Revit, click the **Batch Import** ribbon button.
5. Drag-select your tendon lines, click **Finish** in the top-left of the viewport, select the slab, and choose your downloaded `.json` design file.
6. The 3D ducts will be instantly modeled with all design parameters assigned!

### Workflow B: Standalone Interactive Designer
1. Select a plan line and the slab in Revit.
2. Click **TendonFlow Designer** on the ribbon tab.
3. Model and adjust your drape parameters interactively in the window.
4. Click **Import to Revit** inside the window to generate the 3D duct.

### Workflow C: Updating Duct Profiles
1. Select any modeled tendon duct in Revit.
2. Edit its values in the Revit Properties palette (e.g. `TF_Support_0` to `4`, `TF_LowPoint_1` to `3`, `TF_SpanLength_1` to `3`, or clearances).
3. Click **Update Tendon** on the ribbon to regenerate the 3D geometry immediately!
