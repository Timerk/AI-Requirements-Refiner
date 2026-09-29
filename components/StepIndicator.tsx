export function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Project progress" className="steps">
      <ol>
        {["Describe", "Clarify", "Specification"].map((label, index) => (
          <li
            key={label}
            className={
              index === current ? "active" : index < current ? "complete" : ""
            }
            aria-current={index === current ? "step" : undefined}
          >
            <span className="step-number">
              {index < current ? "✓" : `0${index + 1}`}
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
