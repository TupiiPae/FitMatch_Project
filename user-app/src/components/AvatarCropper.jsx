import React, { useRef, useEffect, useState } from "react";
import { Cropper } from "react-cropper";
import "cropperjs/dist/cropper.css";
import "./AvatarCropper.css";

/**
 * Props:
 * - open: boolean
 * - src: dataURL (base64) của ảnh gốc
 * - onClose(): đóng modal
 * - onConfirm(file: File, previewUrl: string): trả file webp đã crop + preview
 * - title?: string
 */
export default function AvatarCropper({ open, src, onClose, onConfirm, title = "Cắt ảnh đại diện" }) {
  const cropperRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    try {
      setBusy(true);
      const cropper = cropperRef.current?.cropper;
      if (!cropper) return;

      // Canvas vuông 512
      const canvas = cropper.getCroppedCanvas({
        width: 512,
        height: 512,
        imageSmoothingQuality: "high",
      });
      const dataUrl = canvas.toDataURL("image/webp", 0.9);

      // Đổi dataURL -> File (webp)
      const file = dataURLtoFile(dataUrl, `avatar-${Date.now()}.webp`);
      const previewUrl = URL.createObjectURL(file);
      onConfirm?.(file, previewUrl);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="avc-modal" role="dialog" aria-modal="true" aria-labelledby="avc-title">
      <div className="avc-backdrop" onClick={() => !busy && onClose?.()} />
      <div className="avc-card">
        <div className="avc-head">
          <div id="avc-title" className="avc-title">{title}</div>
        </div>
        <div className="avc-body">
          <Cropper
            src={src}
            style={{ height: 400, width: "100%" }}
            // setup cropper
            aspectRatio={1}
            viewMode={1}
            guides={false}
            autoCropArea={1}
            background={false}
            responsive
            checkOrientation
            zoomOnWheel
            ref={cropperRef}
          />
        </div>
        <div className="avc-actions">
          <button className="btn-tertiary" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={busy} style={{ marginLeft: 8 }}>
            {busy ? "Đang xử lý…" : "Dùng ảnh này"}
          </button>
        </div>
      </div>
    </div>
  );
}

function dataURLtoFile(dataUrl, filename) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/webp";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new File([u8], filename, { type: mime });
}
