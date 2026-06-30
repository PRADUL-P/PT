;;; ============================================================
;;; TendonFlow.lsp
;;; AutoCAD LISP Routine — Draw PT Tendon Drape Profile
;;; Version: 1.0  |  Compatible: AutoCAD 2016+
;;; ============================================================
;;; USAGE:
;;;   1. Load this file: AppLoad or drag-drop into AutoCAD.
;;;   2. Type TENDONFLOW at the command prompt.
;;;   3. Select the exported TendonFlow JSON file when prompted.
;;;   4. The tendon drape polyline(s) are drawn on layer TF_TENDON.
;;; ============================================================

(defun c:TENDONFLOW ( / fname data)
  (princ "\n[TendonFlow] Select TendonFlow JSON design file...")
  (setq fname (getfiled "Select TendonFlow JSON File" "" "json" 0))
  (if (null fname)
    (progn (princ "\n[TendonFlow] Cancelled.") (exit))
  )
  (tf:draw-from-file fname)
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

;;; ---- Minimal JSON number extractor ----
;;; Extracts value after "key": from a flat JSON string
(defun tf:json-get (json key / pos1 pos2 val)
  (setq key (strcat "\"" key "\""))
  (setq pos1 (vl-string-search key json))
  (if (null pos1) (return nil))
  ;; move past key":
  (setq pos1 (+ pos1 (strlen key)))
  ;; skip whitespace and colon
  (while (or (= (substr json (1+ pos1) 1) " ")
             (= (substr json (1+ pos1) 1) ":"))
    (setq pos1 (1+ pos1))
  )
  ;; read until comma or } or ]
  (setq pos2 pos1)
  (while (and (< pos2 (strlen json))
              (not (member (substr json (1+ pos2) 1) '("," "}" "]" "\n"))))
    (setq pos2 (1+ pos2))
  )
  (setq val (substr json (1+ pos1) (- pos2 pos1)))
  (atof val)
)

;;; ---- Extract array of numbers after a key ----
(defun tf:json-get-array (json key / pos1 pos2 substr nums tok)
  (setq key (strcat "\"" key "\""))
  (setq pos1 (vl-string-search key json))
  (if (null pos1) (return nil))
  (setq pos1 (vl-string-search "[" json pos1))
  (if (null pos1) (return nil))
  (setq pos2 (vl-string-search "]" json pos1))
  (setq substr (substr json (+ pos1 2) (- pos2 pos1 1)))
  ;; split by comma
  (setq nums '())
  (foreach tok (tf:split-string substr ",")
    (setq nums (append nums (list (atof (vl-string-trim " " tok)))))
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

;;; ---- Draw drape profile from JSON file ----
(defun tf:draw-from-file (fname / json thickness spans
                           numSpans supportH lowH coverTop
                           coverBot spanLengths
                           x0 y0 xStep pts span
                           supH lo co cb
                           x1 x2 xMid yA yB yMid
                           i)
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

  ;; Build polyline points list
  ;; Profile: support → low-point → support → low-point → ... → support
  (setq pts (list (list x0 (+ y0 supportH) 0.0)))
  (setq xCur x0)

  (setq i 0)
  (foreach span spanLengths
    (setq xMid (+ xCur (* span 0.5)))
    (setq xEnd (+ xCur span))
    ;; low point at mid-span
    (setq pts (append pts (list (list xMid (+ y0 lowH) 0.0))))
    ;; support at end
    (setq pts (append pts (list (list xEnd (+ y0 supportH) 0.0))))
    (setq xCur xEnd)
    (setq i (1+ i))
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

  ;; Restore layer
  (command "_.LAYER" "_SET" "0" "")

  (princ (strcat "\n[TendonFlow] Drew " (itoa (length pts))
                 " profile points across "
                 (itoa numSpans) " span(s). "
                 "Layers: TF_TENDON (cyan), TF_SLAB_TOP/BOT (grey)."))
)

;;; ---- Auto-load message ----
(princ "\n[TendonFlow] Loaded. Type TENDONFLOW to draw tendon profile from JSON.")
(princ)
;;; EOF
