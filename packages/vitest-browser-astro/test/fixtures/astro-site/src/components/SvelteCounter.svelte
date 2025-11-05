<script>
  let { initialCount = 0, label = 'Counter' } = $props();

  let count = $state(initialCount);

  function increment() {
    count++;
  }

  function decrement() {
    count--;
  }
</script>

<div data-testid="svelte-counter">
  <h2 data-testid="svelte-label">{label}</h2>
  <p data-testid="svelte-count">{count}</p>
  <button data-testid="svelte-increment" onclick={increment}>Increment</button>
  <button data-testid="svelte-decrement" onclick={decrement}>Decrement</button>
</div>
