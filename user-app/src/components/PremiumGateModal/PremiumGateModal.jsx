import "./PremiumGateModal.css";

export default function PremiumGateModal({
  open,
  title = "Cần nâng cấp Premium",
  message = "",
  onClose,
  onUpgrade,
  upgradeText = "Nâng cấp Premium",
}) {
  if (!open) return null;

  return (
    <div className="pg-backdrop" onClick={onClose}>
      <div className="pg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pg-head">
          <h3 className="pg-title">
            <i className="fa-solid fa-crown" />
            {title}
          </h3>
          <button type="button" className="pg-close" onClick={onClose} aria-label="Đóng">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="pg-body">
          <p className="pg-msg">{message}</p>
        </div>

        <div className="pg-foot">
          <button type="button" className="pg-btn ghost" onClick={onClose}>
            Để sau
          </button>
          <button type="button" className="pg-btn primary" onClick={onUpgrade}>
            {upgradeText}
          </button>
        </div>
      </div>
    </div>
  );
}
