<template>
  <div class="datetime-picker" ref="root">
    <div
      class="datetime-picker__control"
      @click="togglePopup"
      role="button"
      :aria-expanded="open"
    >
      <input
        readonly
        :value="displayValue"
        class="datetime-picker__display"
        aria-haspopup="dialog"
      />
      <span class="datetime-picker__icon">📅</span>
    </div>

    <div
      v-if="open"
      class="datetime-picker__popup"
      @keydown.escape.prevent="closePopup"
    >
      <div class="datetime-picker__popup-body">
        <div class="calendar-header">
          <button class="month-btn" @click.prevent="changeMonth(-1)">◀</button>
          <div class="month-title">{{ monthTitle }}</div>
          <button class="month-btn" @click.prevent="changeMonth(1)">▶</button>
        </div>

        <div class="calendar-grid">
          <div class="weekday" v-for="d in weekdays" :key="d">{{ d }}</div>
          <button
            v-for="cell in monthCells"
            :key="cell.key"
            class="calendar-cell"
            :class="{
              'is-today': cell.isToday,
              'is-selected': cell.isSelected,
              'is-disabled': !cell.inMonth,
            }"
            @click="selectDate(cell.date)"
            :aria-pressed="cell.isSelected"
          >
            {{ cell.day }}
          </button>
        </div>

        <div class="time-row">
          <div class="time-control" role="group" aria-label="Time">
            <div class="time-box">
              <div class="time-label">HH</div>
              <input
                class="time-input"
                type="number"
                min="0"
                max="23"
                v-model.number="hours"
                aria-label="Hours"
              />
            </div>
            <div class="time-sep" aria-hidden="true">:</div>
            <div class="time-box">
              <div class="time-label">MM</div>
              <input
                class="time-input"
                type="number"
                min="0"
                max="59"
                v-model.number="minutes"
                aria-label="Minutes"
              />
            </div>
            <div class="time-sep" aria-hidden="true">:</div>
            <div class="time-box">
              <div class="time-label">SS</div>
              <input
                class="time-input"
                type="number"
                min="0"
                max="59"
                v-model.number="seconds"
                aria-label="Seconds"
              />
            </div>
          </div>
        </div>

        <div class="popup-actions">
          <button class="btn" @click="apply">Apply</button>
          <button class="btn btn--ghost" @click="closePopup">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const open = ref(false);
const selected = ref<Date | null>(null);
const viewDate = ref(new Date());
const hours = ref(0);
const minutes = ref(0);
const seconds = ref(0);
const root = ref<HTMLElement | null>(null);

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      const [d = '', t = ''] = v.split('T');
      selected.value = d ? new Date(d + "T00:00:00Z") : null;
      if (t) {
        const [hh = "0", mm = "0", ss = "0"] = t.split(":");
        hours.value = Number(hh);
        minutes.value = Number(mm);
        seconds.value = Number(ss);
      }
      if (selected.value) viewDate.value = new Date(selected.value);
    } else {
      selected.value = null;
    }
  },
  { immediate: true }
);

const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

const monthTitle = computed(() => {
  const d = viewDate.value;
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
});

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

const monthCells = computed(() => {
  const start = startOfMonth(viewDate.value);
  const end = endOfMonth(viewDate.value);
  const startWeekday = (start.getDay() + 6) % 7; // Monday=0
  const daysInMonth = end.getDate();
  const cells: Array<any> = [];

  // previous month tail
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const day = prevEnd - i;
    const date = new Date(start.getFullYear(), start.getMonth() - 1, day);
    cells.push({
      key: `p-${day}`,
      day,
      date,
      inMonth: false,
      isToday: false,
      isSelected: false,
    });
  }

  // current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(
      viewDate.value.getFullYear(),
      viewDate.value.getMonth(),
      d
    );
    const isToday = isSameDay(date, new Date());
    const isSelected = selected.value ? isSameDay(date, selected.value) : false;
    cells.push({
      key: `c-${d}`,
      day: d,
      date,
      inMonth: true,
      isToday,
      isSelected,
    });
  }

  // next month head to fill 42 cells
  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (startWeekday + daysInMonth) + 1;
    const date = new Date(
      viewDate.value.getFullYear(),
      viewDate.value.getMonth() + 1,
      nextDay
    );
    cells.push({
      key: `n-${nextDay}`,
      day: date.getDate(),
      date,
      inMonth: false,
      isToday: false,
      isSelected: false,
    });
  }

  return cells;
});

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function changeMonth(delta = 1) {
  const d = new Date(viewDate.value);
  d.setMonth(d.getMonth() + delta);
  viewDate.value = d;
}

function selectDate(date: Date) {
  selected.value = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function apply() {
  if (!selected.value) return closePopup();
  const y = selected.value.getFullYear();
  const m = String(selected.value.getMonth() + 1).padStart(2, "0");
  const d = String(selected.value.getDate()).padStart(2, "0");
  const hh = String(
    Math.max(0, Math.min(23, Number(hours.value || 0)))
  ).padStart(2, "0");
  const mm = String(
    Math.max(0, Math.min(59, Number(minutes.value || 0)))
  ).padStart(2, "0");
  const ss = String(
    Math.max(0, Math.min(59, Number(seconds.value || 0)))
  ).padStart(2, "0");
  emit("update:modelValue", `${y}-${m}-${d}T${hh}:${mm}:${ss}`);
  closePopup();
}

function togglePopup() {
  open.value = !open.value;
}
function closePopup() {
  open.value = false;
}

const displayValue = computed(() => {
  if (!props.modelValue) return "";
  // show human-friendly date + time (guard d/t with defaults so TS doesn't complain)
  const [d = '', t = ''] = props.modelValue.split('T');
  return `${d.replace(/-/g, ".")} ${t ?? ""}`.trim();
});

function onDocumentClick(e: MouseEvent) {
  if (!root.value) return;
  if (!root.value.contains(e.target as Node)) closePopup();
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
});
</script>

<style scoped>
.datetime-picker {
  position: relative;
  width: 100%;
}

.datetime-picker__control {
  position: relative; /* needed so icon can be placed inside the input */
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.datetime-picker__display {
  flex: 1;
  padding: 0.6rem 2.8rem 0.6rem 0.75rem; /* room for icon inside input */
  border-radius: 6px; /* match other inputs */
  border: 1px solid var(--color-border, #404040);
  background: var(--color-bg-tertiary, #242424);
  color: var(--color-text, #fff);
  font-size: 0.9rem;
  line-height: 1.2;
}

/* place icon inside the input's visual area */
.datetime-picker__icon {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9rem;
  height: 1.9rem;
  pointer-events: auto; /* allow clicking the icon */
  color: var(--color-text-secondary, #aaa);
  border-radius: 6px;
}

.datetime-picker__control:focus-within .datetime-picker__display,
.datetime-picker__control:hover .datetime-picker__display {
  border-color: var(--color-primary, #646cff);
}

.datetime-picker__popup {
  position: absolute;
  z-index: 40;
  left: 0;
  top: calc(100% + 0.5rem);
  background: var(--color-bg-secondary, #1a1a1a);
  border: 1px solid var(--color-border, #303030);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  padding: 0.75rem;
  min-width: 320px;
}

.datetime-picker__popup-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text, #fff);
  font-weight: 600;
}

.month-btn {
  background: transparent;
  border: 1px solid var(--color-border, #404040);
  color: var(--color-text, #fff);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
}

.weekday {
  text-align: center;
  color: var(--color-text-secondary, #888);
  font-size: 0.75rem;
}

.calendar-cell {
  background: transparent;
  border: none;
  color: var(--color-text, #fff);
  padding: 0.5rem 0.35rem;
  border-radius: 6px;
  cursor: pointer;
}
.calendar-cell.is-today {
  box-shadow: inset 0 0 0 1px rgba(100, 108, 255, 0.15);
}
.calendar-cell.is-selected {
  background: var(--color-primary, #646cff);
  color: white;
}
.calendar-cell.is-disabled {
  color: var(--color-text-secondary, #6e6e6e);
  opacity: 0.5;
}

.time-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center; /* center time controls so left/right gaps are equal */
}
.time-control {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
}
.time-box {
  position: relative;
  min-width: 64px;
  display: inline-flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--color-border, #404040);
  background: var(--color-bg-tertiary, #242424);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.01);
}
.time-label {
  font-size: 0.65rem;
  color: var(--color-text-secondary, #888);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.time-input {
  width: 100%;
  text-align: center;
  border: none;
  background: transparent;
  color: var(--color-text, #fff);
  font-size: 0.95rem;
  -moz-appearance: textfield;
  appearance: textfield;
}
.time-sep {
  color: var(--color-text-secondary, #888);
  font-weight: 600;
  padding: 0 0.25rem;
}
/* hide native number spinners for cleaner look */
.time-input::-webkit-outer-spin-button,
.time-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
.time-input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

.popup-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
.btn {
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  border: none;
  background: var(--color-primary, #646cff);
  color: white;
  cursor: pointer;
}
.btn--ghost {
  background: transparent;
  border: 1px solid var(--color-border, #404040);
  color: var(--color-text, #fff);
}

@media (max-width: 640px) {
  .datetime-picker__popup {
    min-width: 100%;
    left: 0;
    right: 0;
  }
}
</style>
