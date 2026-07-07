const MILESTONES = [
  { hours: 100, label: "İlk güçlü temel" },
  { hours: 250, label: "Düzenli input alışkanlığı" },
  { hours: 500, label: "Orta seviye maruz kalma" },
  { hours: 1000, label: "Büyük input hedefi" },
];

function InputGoalCard({ totalHours, targetHours, onSelectTarget }) {
  const safeTotalHours = Number.isFinite(totalHours) ? totalHours : 0;

  const selectedMilestone =
    MILESTONES.find((milestone) => milestone.hours === targetHours) ||
    MILESTONES[0];

  const isGoalComplete = safeTotalHours >= selectedMilestone.hours;

  const progressPercent = Math.min(
    100,
    Math.round((safeTotalHours / selectedMilestone.hours) * 100)
  );

  const remainingHours = Math.max(
    selectedMilestone.hours - safeTotalHours,
    0
  );

  const nextSuggestedMilestone = MILESTONES.find(
    (milestone) => milestone.hours > selectedMilestone.hours
  );

  let goalText;

  if (isGoalComplete) {
    goalText = nextSuggestedMilestone
      ? `${selectedMilestone.hours} saatlik "${selectedMilestone.label}" hedefini tamamladın! Sıradaki hedef olarak ${nextSuggestedMilestone.hours} saati ("${nextSuggestedMilestone.label}") deneyebilirsin.`
      : `${selectedMilestone.hours} saatlik "${selectedMilestone.label}" hedefini de tamamladın! Muhteşem bir input birikimi oluşturdun.`;
  } else {
    goalText = `${selectedMilestone.hours} saatlik "${
      selectedMilestone.label
    }" hedefine ${remainingHours.toFixed(1)} saat kaldı.`;
  }

  return (
    <section className="input-goal-card">
      <div className="input-goal-head">
        <h2>Input Hedefi</h2>
        <p>{goalText}</p>
      </div>

      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="input-goal-numbers">
        {safeTotalHours.toFixed(1)} / {selectedMilestone.hours} saat · %
        {progressPercent} tamamlandı
      </p>

      <div className="input-goal-milestones">
        {MILESTONES.map((milestone) => {
          const isCompleted = safeTotalHours >= milestone.hours;
          const isSelected = milestone.hours === selectedMilestone.hours;

          return (
            <button
              key={milestone.hours}
              type="button"
              className={`milestone-chip${
                isCompleted ? " milestone-chip--done" : ""
              }${isSelected ? " milestone-chip--active" : ""}`}
              title={milestone.label}
              aria-pressed={isSelected}
              onClick={() => onSelectTarget(milestone.hours)}
            >
              {isCompleted ? "✓ " : ""}
              {milestone.hours} saat
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default InputGoalCard;
