;;; ============================================================
;;; TendonFlow.lsp
;;; AutoCAD LISP Routine — Draw PT Tendon 2D Drape & 3D Solids
;;; Version: 3.0  |  Compatible: AutoCAD 2016+ (3D requires solids support)
;;; ============================================================
;;; USAGE:
;;;   1. Load this file: AppLoad or drag-drop into AutoCAD.
;;;   2. Run commands:
;;;      - TENDONFLOW     : Draws 2D Elevation Drape profile & lines.
;;;      - TENDONFLOW3D   : Models 3D Slab Solid & Swept Tendon Solids.
;;;      - TENDONFROMLINE : Pick a 2D line/polyline in plan, select JSON, 
;;;                         and generate the 3D swept solid tendon along it.
;;;   3. Select the exported TendonFlow JSON file when prompted.
;;; ============================================================

(vl-load-com) ; Load ActiveX/Visual LISP Support

(defun c:TENDONFLOW ( / fname)
  (princ "\n[TendonFlow] Select TendonFlow JSON design file...")
  (setq fname (getfiled "Select TendonFlow JSON File" "" "json" 0))
  (if (null fname)
    (progn (princ "\n[TendonFlow] Cancelled.") (exit))
  )
  (tf:draw-from-file fname)
  (princ "\n[TendonFlow] Done.")
  (princ)
)

(defun c:TENDONFLOW3D ( / fname)
  (princ "\n[TendonFlow 3D] Select TendonFlow JSON design file...")
  (setq fname (getfiled "Select TendonFlow JSON File" "" "json" 0))
  (if (null fname)
    (progn (princ "\n[TendonFlow 3D] Cancelled.") (exit))
  )
  (tf:draw-3d-model fname)
  (princ "\n[TendonFlow 3D] Done.")
  (princ)
)

(defun c:TENDONFROMLINE ( / selEnt ent fname)
  (princ "\n[TendonFlow] Select a 2D Line, Arc, or Polyline representing the tendon plan trajectory...")
  (setq selEnt (entsel))
  (if (null selEnt)
    (progn (princ "\n[TendonFlow] No entity selected.") (exit))
  )
  (setq ent (car selEnt))

  
  (princ "\n[TendonFlow] Select TendonFlow JSON design file...")
  (setq fname (getfiled "Select TendonFlow JSON File" "" "json" 0))
  (if (null fname)
    (progn (princ "\n[TendonFlow] Cancelled.") (exit))
  )
  
  (tf:create-tendon-from-line fname ent)
  (princ "\n[TendonFlow] Done.")
  (princ)
)

;;; ---- Layer setup ----
(defun tf:ensure-layer (lname lcolor / )
  (if (null (tblsearch "LAYER" lname))
    (progn
      (entmake (list
        (cons 0 "LAYER")
        (cons 100 "AcDbSymbolTableRecord")
        (cons 100 "AcDbLayerTableRecord")
        (cons 2 lname)
        (cons 70 0)
        (cons 62 lcolor)
        (cons 6 "Continuous")
      ))
    )
  )
)

;;; ---- Read file contents into a string ----
(defun tf:read-file (fname / fp line result)
  (setq fp (open fname "r"))
  (if (null fp)
    (progn (princ "\n[TendonFlow] Cannot open file.") (exit))
  )
  (setq result "")
  (while (setq line (read-line fp))
    (setq result (strcat result line))
  )
  (close fp)
  result
)

;;; ---- Find start of n-th occurrence of key ----
(defun tf:find-nth-occurrence (str key n / pos count next-pos)
  (setq pos 0 count 0)
  (while (and (< pos (strlen str)) (< count n))
    (setq next-pos (vl-string-search key str pos))
    (if next-pos
      (progn
        (setq pos (1+ next-pos))
        (setq count (1+ count))
      )
      (setq pos (strlen str)) ; break
    )
  )
  (if (= count n) (1- pos) nil)
)

;;; ---- Parse numbers array from string position ----
(defun tf:parse-array-from-pos (json pos / pos1 pos2 subStrVal nums tok)
  (setq pos1 (vl-string-search "[" json pos))
  (if (null pos1)
    nil
    (progn
      (setq pos2 (vl-string-search "]" json pos1))
      (setq subStrVal (substr json (+ pos1 2) (- pos2 pos1 1)))
      (setq nums '())
      (foreach tok (tf:split-string subStrVal ",")

        (if (/= (vl-string-trim " " tok) "")
          (setq nums (append nums (list (atof (vl-string-trim " " tok)))))
        )
      )
      nums
    )
  )
)

;;; ---- Get supports array for specified row index ----
(defun tf:get-supports-array (json rowIdx / pos)
  (setq pos (tf:find-nth-occurrence json "\"supports\"" (1+ rowIdx)))
  (if pos
    (tf:parse-array-from-pos json pos)
    nil
  )
)

;;; ---- Get low points data for specified row index ----
(defun tf:get-lowpoints (json rowIdx / pos pos1 pos2 subStrVal xFracts ys start nextFract colPos commaPos xVal yPos yColPos bracePos yVal)
  (setq pos (tf:find-nth-occurrence json "\"lowPoints\"" (1+ rowIdx)))
  (setq xFracts '() ys '())
  (if pos
    (progn
      (setq pos1 (vl-string-search "[" json pos))
      (setq pos2 (vl-string-search "]" json pos1))
      (setq subStrVal (substr json (+ pos1 2) (- pos2 pos1 1)))
      (setq start 0)
      (while (setq nextFract (vl-string-search "\"xFract\"" subStrVal start))
        ;; Extract xFract
        (setq colPos (vl-string-search ":" subStrVal nextFract))
        (setq commaPos (vl-string-search "," subStrVal colPos))
        (setq xVal (atof (substr subStrVal (+ colPos 2) (- commaPos colPos 1))))
        (setq xFracts (append xFracts (list xVal)))
        
        ;; Extract y
        (setq yPos (vl-string-search "\"y\"" subStrVal commaPos))
        (setq yColPos (vl-string-search ":" subStrVal yPos))
        (setq bracePos (vl-string-search "}" subStrVal yColPos))
        (setq yVal (atof (substr subStrVal (+ yColPos 2) (- bracePos yColPos 1))))
        (setq ys (append ys (list yVal)))
        
        (setq start bracePos)
      )
    )
  )

  (list xFracts ys)
)

;;; ---- Get plan Y tendons for a span index ----
(defun tf:get-plan-y-tendons (json spanIdx / pos pos1 pos2 subStrVal nums tok j)
  (setq pos (vl-string-search "\"planYTendons\"" json))
  (if pos
    (progn
      (setq pos1 pos)
      (setq j 0)
      (while (<= j spanIdx)
        (setq pos1 (vl-string-search "[" json (1+ pos1)))
        (setq j (1+ j))
      )
      (setq pos2 (vl-string-search "]" json pos1))
      (setq subStrVal (substr json (+ pos1 2) (- pos2 pos1 1)))
      (setq nums '())
      (foreach tok (tf:split-string subStrVal ",")

        (if (/= (vl-string-trim " " tok) "")
          (setq nums (append nums (list (atof (vl-string-trim " " tok)))))
        )
      )
      nums
    )
    nil
  )
)

;;; ---- Minimal JSON number extractor ----
(defun tf:json-get (json key / pos1 pos2 val)
  (setq key (strcat "\"" key "\""))
  (setq pos1 (vl-string-search key json))
  (if (null pos1) (return nil))
  (setq pos1 (+ pos1 (strlen key)))
  (while (or (= (substr json (1+ pos1) 1) " ")
             (= (substr json (1+ pos1) 1) ":"))
    (setq pos1 (1+ pos1))
  )
  (setq pos2 pos1)
  (while (and (< pos2 (strlen json))
              (not (member (substr json (1+ pos2) 1) '("," "}" "]" "\n"))))
    (setq pos2 (1+ pos2))
  )
  (setq val (substr json (1+ pos1) (- pos2 pos1)))
  (atof val)
)

;;; ---- Extract array of numbers after a key ----
(defun tf:json-get-array (json key / pos1 pos2 subStrVal nums tok)
  (setq key (strcat "\"" key "\""))
  (setq pos1 (vl-string-search key json))
  (if (null pos1) (return nil))
  (setq pos1 (vl-string-search "[" json pos1))
  (if (null pos1) (return nil))
  (setq pos2 (vl-string-search "]" json pos1))
  (setq subStrVal (substr json (+ pos1 2) (- pos2 pos1 1)))
  (setq nums '())
  (foreach tok (tf:split-string subStrVal ",")

    (if (/= (vl-string-trim " " tok) "")
      (setq nums (append nums (list (atof (vl-string-trim " " tok)))))
    )
  )
  nums
)

;;; ---- Simple string split ----
(defun tf:split-string (str delim / result part i c)
  (setq result '() part "" i 1)
  (while (<= i (strlen str))
    (setq c (substr str i 1))
    (if (= c delim)
      (progn
        (setq result (append result (list part)))
        (setq part "")
      )
      (setq part (strcat part c))
    )
    (setq i (1+ i))
  )
  (if (/= part "") (setq result (append result (list part))))
  result
)

;;; ---- Evaluates double-quadratic parabola height ----
(defun tf:get-parabola-z (localX L yL yR ym xFract aRatio / xm X1 Y1 b1 xInf a1_low a1_supp dx X2 Y2 b2 a2_low a2_supp)
  (setq xm (* xFract L))
  (if (<= localX xm)
    (progn
      (setq X1 xm)
      (setq Y1 (- yL ym))
      (setq b1 (/ (* aRatio L) X1))
      (if (< b1 0.05) (setq b1 0.05))
      (if (> b1 0.95) (setq b1 0.95))
      (setq xInf (* b1 X1))
      (setq a1_low (/ Y1 (* (- 1.0 b1) X1 X1)))
      (setq a1_supp (/ Y1 (* b1 X1 X1)))
      (if (>= localX xInf)
        (progn
          (setq dx (- xm localX))
          (+ ym (* a1_low dx dx))
        )
        (progn
          (setq dx localX)
          (- yL (* a1_supp dx dx))
        )
      )
    )
    (progn
      (setq X2 (- L xm))
      (setq Y2 (- yR ym))
      (setq b2 (/ (* aRatio L) X2))
      (if (< b2 0.05) (setq b2 0.05))
      (if (> b2 0.95) (setq b2 0.95))
      (setq xInf (- L (* b2 X2)))
      (setq a2_low (/ Y2 (* (- 1.0 b2) X2 X2)))
      (setq a2_supp (/ Y2 (* b2 X2 X2)))
      (if (<= localX xInf)
        (progn
          (setq dx (- localX xm))
          (+ ym (* a2_low dx dx))
        )
        (progn
          (setq dx (- L localX))
          (- yR (* a2_supp dx dx))
        )
      )
    )
  )
)

;;; ---- Generates points list along 3D profile path ----
(defun tf:get-tendon-3d-points (spanLengths supports lowPointsY lowPointsXFract aRatio y_mm / points currentX spanIdx L yL yR ym xFract segments step i localX z pt)
  (setq points '())
  (setq currentX 0.0)
  (setq spanIdx 0)
  (foreach L spanLengths
    (setq yL (nth spanIdx supports))
    (setq yR (nth (1+ spanIdx) supports))
    (setq ym (nth spanIdx lowPointsY))
    (setq xFract (nth spanIdx lowPointsXFract))
    
    (setq segments 40)
    (setq step (/ L segments))
    (setq i 0)
    (while (<= i segments)
      (if (or (> spanIdx 0) (> i 0))
        (progn
          (setq localX (* i step))
          (setq z (tf:get-parabola-z localX L yL yR ym xFract aRatio))
          (setq pt (list (+ currentX localX) y_mm z))
          (setq points (append points (list pt)))
        )
      )
      (setq i (1+ i))
    )
    (setq currentX (+ currentX L))
    (setq spanIdx (1+ spanIdx))
  )
  points
)

;;; ---- Draw 2D drape profile from JSON file ----
(defun tf:draw-from-file (fname / json thickness spans
                           numSpans supportH lowH coverTop
                           coverBot spanLengths
                           x0 y0 pts span
                           xMid xEnd xTotal oldSnap)
  (setq json (tf:read-file fname))

  ;; Extract design parameters
  (setq thickness   (tf:json-get json "slabThickness"))   ; mm
  (setq numSpans    (fix (tf:json-get json "numSpans")))
  (setq supportH    (tf:json-get json "supportHeight"))   ; mm from bottom
  (setq lowH        (tf:json-get json "lowPointHeight"))  ; mm from bottom
  (setq coverTop    (tf:json-get json "coverTop"))        ; mm
  (setq coverBot    (tf:json-get json "coverBottom"))     ; mm
  (setq spanLengths (tf:json-get-array json "spanLengths")) ; meters

  ;; Defaults if missing
  (if (= thickness 0.0)   (setq thickness 250.0))
  (if (= numSpans 0)      (setq numSpans 1))
  (if (= supportH 0.0)    (setq supportH (- thickness coverTop 7.0)))
  (if (= lowH 0.0)        (setq lowH (+ coverBot 7.0)))
  (if (null spanLengths)  (setq spanLengths '(8.0)))

  ;; Scale: mm → drawing units (assume 1 drawing unit = 1 mm)
  ;; Spans are in metres → convert to mm
  (setq spanLengths (mapcar '(lambda (s) (* s 1000.0)) spanLengths))

  ;; Ensure layer exists
  (tf:ensure-layer "TF_TENDON"   4)   ; cyan
  (tf:ensure-layer "TF_SLAB_TOP" 8)   ; grey
  (tf:ensure-layer "TF_SLAB_BOT" 8)

  ;; Ask user for insertion origin
  (setq p0 (getpoint "\n[TendonFlow] Pick start point (left support): "))
  (if (null p0) (exit))
  (setq x0 (car p0) y0 (cadr p0))

  (setq oldSnap (getvar "OSMODE"))
  (setvar "OSMODE" 0)

  ;; Build polyline points list
  (setq pts (list (list x0 (+ y0 supportH) 0.0)))
  (setq xCur x0)

  (foreach span spanLengths
    (setq xMid (+ xCur (* span 0.5)))
    (setq xEnd (+ xCur span))
    (setq pts (append pts (list (list xMid (+ y0 lowH) 0.0))))
    (setq pts (append pts (list (list xEnd (+ y0 supportH) 0.0))))
    (setq xCur xEnd)
  )

  ;; Draw tendon polyline
  (command "_.LAYER" "_SET" "TF_TENDON" "")
  (command "_.PLINE")
  (foreach pt pts (command pt))
  (command "")

  ;; Draw slab top and bottom reference lines
  (setq xTotal xCur)
  (command "_.LAYER" "_SET" "TF_SLAB_TOP" "")
  (command "_.LINE"
    (list x0 (+ y0 thickness) 0.0)
    (list xTotal (+ y0 thickness) 0.0)
    "")
  (command "_.LAYER" "_SET" "TF_SLAB_BOT" "")
  (command "_.LINE"
    (list x0 y0 0.0)
    (list xTotal y0 0.0)
    "")

  ;; Restore settings
  (setvar "OSMODE" oldSnap)
  (command "_.LAYER" "_SET" "0" "")

  (princ (strcat "\n[TendonFlow] Drew " (itoa (length pts))
                 " profile points across "
                 (itoa numSpans) " span(s). "))
)

;;; ---- Model 3D Concrete Slab & Tendon Solids from JSON file ----
(defun tf:draw-3d-model (fname / json thickness numSpans spanLengths slabWidth coverTop coverBottom inflectionRatio ductDia planXTendons supports lowPointsData lowPointsXFract lowPointsY yTotal totalLength p0 x0 y0 z0 oldSnap y_offset y_curr pts pathEnt profileEnt spanStartX spanIdx L yTends yTend absX zHeight ptStart ptEnd)
  (setq json (tf:read-file fname))

  ;; 1. Extract parameters
  (setq thickness        (tf:json-get json "slabThickness"))      ; mm
  (setq numSpans         (fix (tf:json-get json "numSpans")))
  (setq slabWidth        (tf:json-get json "slabWidth"))          ; meters
  (setq coverTop         (tf:json-get json "coverTop"))           ; mm
  (setq coverBottom      (tf:json-get json "coverBottom"))        ; mm
  (setq inflectionRatio  (tf:json-get json "inflectionRatio"))    ; ratio
  (setq ductDia          (tf:json-get json "ductDiameter"))       ; mm

  ;; Defaults if missing
  (if (= thickness 0.0)        (setq thickness 250.0))
  (if (= numSpans 0)           (setq numSpans 1))
  (if (= slabWidth 0.0)        (setq slabWidth 12.0))
  (if (= coverTop 0.0)         (setq coverTop 25.0))
  (if (= coverBottom 0.0)      (setq coverBottom 25.0))
  (if (= inflectionRatio 0.0)  (setq inflectionRatio 0.1))
  (if (= ductDia 0.0)          (setq ductDia 25.0))

  ;; Parse arrays
  (setq spanLengths (tf:json-get-array json "spanLengths")) ; meters
  (if (null spanLengths) (setq spanLengths '(8.0)))
  (setq spanLengths (mapcar '(lambda (s) (* s 1000.0)) spanLengths))

  (setq planXTendons (tf:json-get-array json "planXTendons")) ; meters
  (if (null planXTendons) (setq planXTendons '(1.5 3.0 4.5 6.0 7.5 9.0 10.5)))
  (setq planXTendons (mapcar '(lambda (y) (* y 1000.0)) planXTendons))

  ;; Get control points of row 0 (default row index)
  (setq supports (tf:get-supports-array json 0))
  (if (null supports)
    (setq supports (mapcar '(lambda (x) (- thickness coverTop (/ ductDia 2.0))) (append (list 0.0) spanLengths)))
  )

  (setq lowPointsData (tf:get-lowpoints json 0))
  (setq lowPointsXFract (car lowPointsData))
  (setq lowPointsY (cadr lowPointsData))
  (if (null lowPointsY)
    (progn
      (setq lowPointsXFract '())
      (setq lowPointsY '())
      (foreach L spanLengths
        (setq lowPointsXFract (append lowPointsXFract '(0.5)))
        (setq lowPointsY (append lowPointsY (list (+ coverBottom (/ ductDia 2.0)))))
      )
    )
  )

  ;; Ensure layers exist
  (tf:ensure-layer "TF_3D_SLAB" 8)    ; grey
  (tf:ensure-layer "TF_3D_TENDON" 4)  ; cyan

  ;; Ask user for insertion origin
  (setq p0 (getpoint "\n[TendonFlow 3D] Pick insertion origin (0,0,0): "))
  (if (null p0) (exit))
  (setq x0 (car p0) y0 (cadr p0) z0 (caddr p0))
  (if (null z0) (setq z0 0.0))

  ;; Save Osnap
  (setq oldSnap (getvar "OSMODE"))
  (setvar "OSMODE" 0)

  ;; 2. Draw 3D Concrete Slab box
  (princ "\n[TendonFlow 3D] Drawing 3D Slab Solid...")
  (setq totalLength 0.0)
  (foreach L spanLengths (setq totalLength (+ totalLength L)))
  (setq yTotal (* slabWidth 1000.0))

  (command "_.LAYER" "_SET" "TF_3D_SLAB" "")
  (command "_.BOX"
    (list x0 y0 z0)
    (list (+ x0 totalLength) (+ y0 yTotal) (+ z0 thickness))
  )

  ;; 3. Draw Longitudinal (X) Tendons in 3D (Swept solid ducts)
  (princ "\n[TendonFlow 3D] Modeling 3D Longitudinal Tendons...")
  (command "_.LAYER" "_SET" "TF_3D_TENDON" "")

  (foreach y_offset planXTendons
    (setq y_curr (+ y0 y_offset))
    (setq pts (tf:get-tendon-3d-points spanLengths supports lowPointsY lowPointsXFract inflectionRatio y_curr))
    
    ;; Shift points by insertion origin
    (setq pts (mapcar '(lambda (pt) (list (+ x0 (car pt)) (cadr pt) (+ z0 (caddr pt)))) pts))

    ;; Draw 3D Polyline path
    (command "_.3DPOLY")
    (foreach pt pts (command pt))
    (command "")
    (setq pathEnt (entlast))

    ;; Draw circle for sweep profile at start point
    (command "_.CIRCLE" (car pts) (/ ductDia 2.0))
    (setq profileEnt (entlast))

    ;; Sweep solid
    (command "_.SWEEP" profileEnt "" pathEnt)
  )

  ;; 4. Draw Transverse (Y) Tendons in 3D (Solid cylinders)
  (princ "\n[TendonFlow 3D] Modeling 3D Transverse Tendons...")
  (setq spanStartX 0.0)
  (setq spanIdx 0)
  (foreach L spanLengths
    (setq yTends (tf:get-plan-y-tendons json spanIdx))
    (if yTends
      (foreach yTend yTends
        (setq absX (+ spanStartX (* yTend 1000.0)))
        (setq zHeight (nth spanIdx supports))
        (setq ptStart (list (+ x0 absX) y0 (+ z0 zHeight)))
        (setq ptEnd (list (+ x0 absX) (+ y0 yTotal) (+ z0 zHeight)))
        (command "_.CYLINDER" ptStart "R" (/ ductDia 2.0) "C" ptEnd)
      )
    )
    (setq spanStartX (+ spanStartX L))
    (setq spanIdx (1+ spanIdx))
  )

  ;; Restore Osnap settings and active layer
  (setvar "OSMODE" oldSnap)
  (command "_.LAYER" "_SET" "0" "")
  (princ "\n[TendonFlow 3D] Completed modeling 3D solid PT Slab & Tendons successfully.")
)

;;; ---- Model 3D Tendon Solid along a selected 2D line/polyline ----
(defun tf:create-tendon-from-line (fname ent / json thickness numSpans spanLengths coverTop coverBottom inflectionRatio ductDia supports lowPointsData lowPointsXFract lowPointsY startDist endDist totalLen segments step points i dist pt2d designDist accumX spanIdx localX L yL yR ym xFract z pt zSlabBottom pSlabBottom pathEnt profileEnt oldSnap totalDesignLength scaleFactor k)
  (setq json (tf:read-file fname))

  ;; 1. Extract parameters
  (setq thickness        (tf:json-get json "slabThickness"))      ; mm
  (setq numSpans         (fix (tf:json-get json "numSpans")))
  (setq coverTop         (tf:json-get json "coverTop"))           ; mm
  (setq coverBottom      (tf:json-get json "coverBottom"))        ; mm
  (setq inflectionRatio  (tf:json-get json "inflectionRatio"))    ; ratio
  (setq ductDia          (tf:json-get json "ductDiameter"))       ; mm

  ;; Defaults if missing
  (if (= thickness 0.0)        (setq thickness 250.0))
  (if (= numSpans 0)           (setq numSpans 1))
  (if (= coverTop 0.0)         (setq coverTop 25.0))
  (if (= coverBottom 0.0)      (setq coverBottom 25.0))
  (if (= inflectionRatio 0.0)  (setq inflectionRatio 0.1))
  (if (= ductDia 0.0)          (setq ductDia 25.0))

  ;; Parse arrays
  (setq spanLengths (tf:json-get-array json "spanLengths")) ; meters
  (if (null spanLengths) (setq spanLengths '(8.0)))
  (setq spanLengths (mapcar '(lambda (s) (* s 1000.0)) spanLengths))

  ;; Get control points of row 0 (default row index)
  (setq supports (tf:get-supports-array json 0))
  (if (null supports)
    (setq supports (mapcar '(lambda (x) (- thickness coverTop (/ ductDia 2.0))) (append (list 0.0) spanLengths)))
  )

  (setq lowPointsData (tf:get-lowpoints json 0))
  (setq lowPointsXFract (car lowPointsData))
  (setq lowPointsY (cadr lowPointsData))
  (if (null lowPointsY)
    (progn
      (setq lowPointsXFract '())
      (setq lowPointsY '())
      (foreach L spanLengths
        (setq lowPointsXFract (append lowPointsXFract '(0.5)))
        (setq lowPointsY (append lowPointsY (list (+ coverBottom (/ ductDia 2.0)))))
      )
    )
  )

  ;; Ask user for slab bottom Z elevation
  (setq pSlabBottom (getpoint "\n[TendonFlow] Pick a point on the bottom of the slab (or press Enter for Z=0): "))
  (if pSlabBottom
    (setq zSlabBottom (caddr pSlabBottom))
    (setq zSlabBottom 0.0)
  )

  ;; Ensure layers exist
  (tf:ensure-layer "TF_3D_TENDON" 4)  ; cyan

  ;; Save Osnap
  (setq oldSnap (getvar "OSMODE"))
  (setvar "OSMODE" 0)

  ;; Get curve properties using ActiveX
  (setq startDist (vlax-curve-getDistAtParam ent (vlax-curve-getStartParam ent)))
  (setq endDist (vlax-curve-getDistAtParam ent (vlax-curve-getEndParam ent)))
  (setq totalLen (- endDist startDist))

  ;; Scale curve points to fit span lengths
  (setq totalDesignLength 0.0)
  (foreach L spanLengths (setq totalDesignLength (+ totalDesignLength L)))
  (setq scaleFactor (/ totalLen totalDesignLength))

  (setq segments 80)
  (setq step (/ totalLen segments))
  (setq points '())
  
  (setq i 0)
  (while (<= i segments)
    (setq dist (+ startDist (* i step)))
    (setq pt2d (vlax-curve-getPointAtDist ent dist))
    
    ;; Calculate design coordinate distance to evaluate vertical profile parabola
    (setq designDist (/ (* i step) scaleFactor))
    
    ;; Find which span this designDist falls in
    (setq accumX 0.0)
    (setq spanIdx -1)
    (setq localX 0.0)
    (setq k 0)
    (while (and (< k numSpans) (= spanIdx -1))
      (setq L (nth k spanLengths))
      (if (and (>= designDist accumX) (<= designDist (+ accumX L 0.001)))
        (progn
          (setq spanIdx k)
          (setq localX (- designDist accumX))
        )
      )
      (setq accumX (+ accumX L))
      (setq k (1+ k))
    )
    (if (= spanIdx -1)
      (progn
        (setq spanIdx (1- numSpans))
        (setq localX (nth spanIdx spanLengths))
      )
    )

    (setq yL (nth spanIdx supports))
    (setq yR (nth (1+ spanIdx) supports))
    (setq ym (nth spanIdx lowPointsY))
    (setq xFract (nth spanIdx lowPointsXFract))
    
    (setq z (tf:get-parabola-z localX (nth spanIdx spanLengths) yL yR ym xFract inflectionRatio))
    
    ;; Create 3D coordinate point relative to slab bottom
    (setq pt (list (car pt2d) (cadr pt2d) (+ zSlabBottom z)))
    (setq points (append points (list pt)))
    
    (setq i (1+ i))
  )

  ;; Draw 3D Polyline path along AutoCAD line
  (command "_.LAYER" "_SET" "TF_3D_TENDON" "")
  (command "_.3DPOLY")
  (foreach pt points (command pt))
  (command "")
  (setq pathEnt (entlast))

  ;; Draw circle for sweep profile at start point
  (command "_.CIRCLE" (car points) (/ ductDia 2.0))
  (setq profileEnt (entlast))

  ;; Sweep solid
  (command "_.SWEEP" profileEnt "" pathEnt)

  ;; Restore settings
  (setvar "OSMODE" oldSnap)
  (command "_.LAYER" "_SET" "0" "")
  (princ "\n[TendonFlow] Successfully created 3D Swept Tendon Solid along selected line.")
)

;;; ---- Auto-load message ----
(princ "\n[TendonFlow] Loaded. Commands:\n  - TENDONFLOW     (2D profile)\n  - TENDONFLOW3D   (3D solid slab & tendons)\n  - TENDONFROMLINE (3D tendon from picked CAD line)")
(princ)
;;; EOF
