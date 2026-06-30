# TendonFlow - Post-Tensioned Slab Tendon Path Designer & Revit Add-in

TendonFlow is a high-performance web-based engineering tool and Revit add-in for post-tensioned (PT) slab tendon path design, trajectory modeling, and Revit integration.

**Live Web Designer**: [https://pradul-p.github.io/PT/](https://pradul-p.github.io/PT/)

---

## 🚀 Revit Add-in Installation

To install the TendonFlow pyRevit extension in Autodesk Revit:

1. Open the [TendonFlow Designer](https://pradul-p.github.io/PT/) in your web browser.
2. Click the **`Download Revit Extension`** button in the header to download the `TendonFlow.extension.zip` file.
3. Extract the downloaded `.zip` file on your computer.
4. Move or copy the extracted **`TendonFlow.extension`** folder into your local pyRevit Extensions folder.
   * *Typical Location:* `C:\Users\<YourUsername>\AppData\Roaming\pyRevit\Extensions\`
5. Open Autodesk Revit, navigate to the **pyRevit** tab on the ribbon, and click **`Reload`**.
6. A new **TendonFlow** tab will appear on your Revit Ribbon, containing the commands:
   * **`TendonFlow Designer`**: Launches the interactive design bridge.
   * **`Tendon From Line`**: Models a 3D tendon duct on a selected plan line from a design file.
   * **`Batch Import`**: Models multiple tendons at once on selected plan lines from a design file.
   * **`Update Tendon`**: Updates the 3D geometry of selected tendons when parameters are modified in Revit.

---

## 📖 Step-by-Step Usage Workflows

### Workflow A: Batch Import (Recommended - Fast & Offline)
1. In Revit, model your concrete slab floor and draw plan lines representing the tendon layouts.
2. Go to the [TendonFlow Designer](https://pradul-p.github.io/PT/) in your web browser.
3. Design your tendon spans, support elevations, and drape profiles in the visualizer.
4. Click **`Save Design`** in the header to export the design `.json` file.
5. In Revit, click the **`Batch Import`** button on the TendonFlow tab.
6. Drag-select all the plan lines you wish to model and click **`Finish`** in the top-left of the Revit viewport.
7. Select the concrete slab floor element.
8. Choose your exported `.json` design file in the file explorer prompt.
9. **Done!** TendonFlow instantly models all 3D tendon swept solids inside the slab, writing all parameters (supports, low points, covers, force, and span lengths) to the elements.

### Workflow B: Interactive Designer Bridge
1. In Revit, select a plan curve line and the concrete slab.
2. Click the **`TendonFlow Designer`** button on the TendonFlow ribbon.
3. An interactive window will load the slab's length, thickness, and span boundaries directly from Revit.
4. Customize your drape profile inside the window.
5. Click **`Import to Revit`** inside the designer panel.
6. **Done!** The 3D duct is modeled inside the slab immediately.

### Workflow C: Updating Existing Tendons
1. Select any modeled tendon duct (`Generic Model` DirectShape) in Revit.
2. In the **Properties Palette**, adjust any of the parameters under the **Constraints** or **Identity Data** groups:
   * **`TF_Support_0` to `4`**: Heights of the tendon supports from the slab bottom (in mm).
   * **`TF_LowPoint_1` to `3`**: Heights of the low points from the slab bottom (in mm).
   * **`TF_SpanLength_1` to `3`**: Lengths of individual spans (in mm).
   * **`TF_CoverTop` / `TF_CoverBottom`**: Clearances.
3. Click the **`Update Tendon`** button on the TendonFlow ribbon.
4. The 3D swept geometry immediately updates to reflect your modified values!

---

## 🛠️ Parameters List

TendonFlow binds the following parameters to the modeled elements for downstream coordination:

| Parameter Name | Category | Unit Type | Description |
| :--- | :--- | :--- | :--- |
| **`TF_TendonForce`** | Structural Force | Force | Prestressing force at jacking end (kN) |
| **`TF_DuctDiameter`** | Duct Size | Length | Outer diameter of the tendon duct (mm) |
| **`TF_CoverTop`** | Clearance | Length | Minimum top concrete cover (mm) |
| **`TF_CoverBottom`** | Clearance | Length | Minimum bottom concrete cover (mm) |
| **`TF_SlabThickness`** | Dimensions | Length | Thickness of the host slab (mm) |
| **`TF_SpanLength_1`** | Dimensions | Length | Length of Span 1 (mm) |
| **`TF_SpanLength_2`** | Dimensions | Length | Length of Span 2 (mm) |
| **`TF_SpanLength_3`** | Dimensions | Length | Length of Span 3 (mm) |
| **`TF_Support_0` to `4`** | Elevations | Length | Support heights relative to slab bottom (mm) |
| **`TF_LowPoint_1` to `3`** | Elevations | Length | Support heights relative to slab bottom (mm) |
