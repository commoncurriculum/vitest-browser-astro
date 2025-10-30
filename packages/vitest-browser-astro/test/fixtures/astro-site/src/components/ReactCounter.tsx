import { useState } from "react";

interface ReactCounterProps {
	initialCount?: number;
	label?: string;
}

export default function ReactCounter({
	initialCount = 0,
	label = "React Count",
}: ReactCounterProps) {
	const [count, setCount] = useState(initialCount);

	return (
		<div data-testid="react-counter">
			<h2 data-testid="react-label">{label}</h2>
			<p data-testid="react-count">{count}</p>
			<button data-testid="react-increment" onClick={() => setCount(count + 1)}>
				Increment
			</button>
			<button data-testid="react-decrement" onClick={() => setCount(count - 1)}>
				Decrement
			</button>
		</div>
	);
}
