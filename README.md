# TendonFlow — Post-Tensioned Slab Tendon Path Designer & Revit Add-in

TendonFlow is a high-performance web-based engineering tool and Revit add-in for post-tensioned (PT) concrete slab tendon path design, trajectory modelling, and BIM integration.

**🌐 Live Web Designer:** [https://pradul-p.github.io/PT/](https://pradul-p.github.io/PT/)

---

## ✨ Features

| Category | Capability |
|---|---|
| **Geometry** | Multi-span design (1–3 spans), 1–4 column rows, configurable slab dimensions |
| **Tendon Profiles** | Drag-and-drop drape handles, double-quadratic parabola engine, support & low-point control |
| **X-Tendon Sets** | Per-set colour coding in plan and elevation views; click any tendon in plan to edit its profile |
| **Visualisation** | Split View (elevation + plan side-by-side), zoom/pan controls (0.5× – 5×) for each view |
| **Y-Tendons** | Perpendicular tendon sets with individual profiles and clash detection |
| **Losses** | Coulomb friction & anchor-slip loss model, friction & wobble coefficients |
| **Verification** | Real-time concrete cover checks, load-balancing ratio, curvature limit, duct-clash detection |
| **Corner Warping** | BL/BR/TR/TL corner Z-offsets for sloped/warped slabs; propagated into 3D export |
| **Angle Locking** | End slope angle lock with green ✅ / red ❌ compliance indicators |
| **2D CAD Export** | R12 DXF — elevation profile, 2D plan layout, section cuts |
| **3D CAD Export** | 3D solid DXF with per-set coloured layers (see table below) |
| **Revit** | pyRevit extension — Batch Import, Tendon From Line, Update Tendon |
| **AutoCAD LISP** | `TENDONFLOW`, `DRAWELEVC/F`, `DRAWPLANC/F` commands |
| **Data** | Save / Load design JSON; clipboard-based coordinate transfer |

---

## 🗂️ 3D Export Layer Structure

When you click **Export 3D DXF**, each tendon group is placed on its own AutoCAD layer with a distinct colour. You can toggle groups on/off independently in AutoCAD, BricsCAD, or Revit.

| Layer Name | Contents | ACI Colour |
|---|---|---|
| `TF_3D_SLAB` | Concrete slab 3DFace mesh | Gray (8) |
| `TF_3D_XTENDON_SET1` | X-Tendon Set 1 swept cylinders | Yellow-Green (130) |
| `TF_3D_XTENDON_SET2` | X-Tendon Set 2 swept cylinders | Purple (200) |
| `TF_3D_XTENDON_SET3` | X-Tendon Set 3 swept cylinders | Green (90) |
| `TF_3D_XTENDON_SET4` | X-Tendon Set 4 swept cylinders | Cyan (150) |
| `TF_3D_YTENDON_SET1` | Y-Tendon (transverse) Set 1 | Pink (220) |
| `TF_3D_YTENDON_SET2` | Y-Tendon (transverse) Set 2 | Orange (30) |
| _(more sets follow the same pattern)_ | | |

> Each X-tendon uses its actual **above** or **below** elevation profile for the 3D drape — not a single shared profile.

---

## 🖥️ Interface Overview

| Element | Description |
|---|---|
| **Elevation Profile tab** | 2D cross-section showing active tendon drape, cover limits, drag handles, and perpendicular tendon cross-sections |
| **2D Plan Layout tab** | Top-down plan view with X-tendons (colour by set), Y-tendons, columns, and slab boundary |
| **Split View tab** | Both elevation and plan side-by-side; click a tendon in plan to instantly switch its profile in elevation |
| **Sidebar panels** | Slab geometry, spans, X-tendon sets, Y-tendon sets, prestress, corner elevations, angle locks |
| **Section tabs** (Above/Below Row N) | Switch which tendon row's drape profile is shown and edited in elevation view |
| **Export panel** | 2D DXF (elevation/plan/section), 3D DXF (solid), JSON save, AutoCAD LISP data |

---

## 🚀 Revit Add-in Installation

To install the TendonFlow pyRevit extension in Autodesk Revit:

1. Open the [TendonFlow Designer](https://pradul-p.github.io/PT/) in your web browser.
2. Click the **`Download Revit Extension`** button in the header to download `TendonFlow.extension.zip`.
3. Extract the downloaded `.zip` file.
4. Move the extracted **`TendonFlow.extension`** folder into your pyRevit Extensions folder.
   - *Typical Location:* `C:\Users\<YourUsername>\AppData\Roaming\pyRevit\Extensions\`
5. Open Autodesk Revit, go to the **pyRevit** tab, and click **`Reload`**.
6. A new **TendonFlow** tab appears with four commands:
   - **`TendonFlow Designer`** — Launches the interactive design bridge
   - **`Tendon From Line`** — Models a 3D tendon duct on a selected plan line
   - **`Batch Import`** — Models multiple tendons from a design JSON file
   - **`Update Tendon`** — Updates 3D geometry when Revit parameters change

---

## 📖 Step-by-Step Usage Workflows

### Workflow A: Batch Import (Recommended — Fast & Offline)
1. Model your concrete slab and draw plan lines in Revit.
2. Open [TendonFlow Designer](https://pradul-p.github.io/PT/) and design tendon spans, drape profiles, and X/Y tendon sets.
3. Click **`Save Design`** in the header to export the design `.json` file.
4. In Revit, click **`Batch Import`**, drag-select all plan lines, click **`Finish`**, select the slab, and choose the `.json` file.
5. Done — all 3D tendon swept solids are modelled instantly.

### Workflow B: Interactive Designer (Sync from Revit)
1. Click **`TendonFlow Designer`** on the TendonFlow ribbon.
2. Click **`🔗 Select Revit Slab & Line`** and pick the plan line and host slab in Revit.
3. The designer auto-populates slab thickness and span lengths.
4. Design your profiles, then click **`⬇ Download Design JSON`**.
5. Use **`Batch Import`** to model the 3D duct.

### Workflow C: Updating Existing Tendons
1. Select a modelled tendon duct in Revit.
2. Adjust parameters in the Properties Palette (`TF_Support_0`–`4`, `TF_LowPoint_1`–`3`, etc.).
3. Click **`Update Tendon`** — 3D geometry updates immediately.

---

## 🛠️ Revit Parameter Reference

| Parameter | Category | Description |
|---|---|---|
| `TF_TendonForce` | Structural Force | Prestressing force at jacking end (kN) |
| `TF_DuctDiameter` | Duct Size | Outer diameter of tendon duct (mm) |
| `TF_CoverTop` | Clearance | Minimum top concrete cover (mm) |
| `TF_CoverBottom` | Clearance | Minimum bottom concrete cover (mm) |
| `TF_SlabThickness` | Dimensions | Host slab thickness (mm) |
| `TF_SpanLength_1/2/3` | Dimensions | Individual span lengths (mm) |
| `TF_Support_0` – `TF_Support_4` | Elevations | Support heights from slab bottom (mm) |
| `TF_LowPoint_1` – `TF_LowPoint_3` | Elevations | Low point heights from slab bottom (mm) |

---

## 🤝 Contributing

Pull requests and issues welcome at [github.com/PRADUL-P/PT](https://github.com/PRADUL-P/PT).
