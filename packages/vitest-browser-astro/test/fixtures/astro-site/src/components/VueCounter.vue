<script setup>
import { ref } from "vue";

const props = defineProps({
	initialCount: {
		type: Number,
		default: 0,
	},
	label: {
		type: String,
		default: "Counter",
	},
});

const count = ref(props.initialCount);

function increment() {
	count.value++;
}

function decrement() {
	count.value--;
}
</script>

<template>
	<div data-testid="vue-counter">
		<h2 data-testid="vue-label">{{ label }}</h2>
		<p data-testid="vue-count">{{ count }}</p>
		<button data-testid="vue-increment" @click="increment">Increment</button>
		<button data-testid="vue-decrement" @click="decrement">Decrement</button>
	</div>
</template>
