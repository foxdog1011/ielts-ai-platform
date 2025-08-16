import CalibrationChart from "@/components/CalibrationChart";

export const dynamic = "force-dynamic";

export default function CalibrationPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-[20px] font-semibold tracking-tight">Evidence · Quantile Calibration</h1>
      <p className="mt-2 text-sm text-zinc-600">
        大量未標註語音 → 產生 overall_01（0..1） → 依分位數映射到 IELTS Band（4..9）。用於 Demo 的穩定校準。
      </p>
      <div className="mt-4">
        <CalibrationChart />
      </div>
    </main>
  );
}
