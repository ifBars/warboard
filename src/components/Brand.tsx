import { assetUrl } from "../assetUrl";
export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`wordmark${compact ? " wordmark-compact" : ""}`}>
      <img src={assetUrl("/brand-mark.svg")} width="40" height="30" alt="" />
      <span>WARBOARD</span>
    </span>
  );
}
