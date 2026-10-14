<script setup>
import { useLoaderStore } from '@/stores/loader'

const loader = useLoaderStore()
</script>

<template>
  <!-- 固定顶部定位，pointer-events-none 保证不拦截任何页面交互 -->
  <div
    class="global-loader fixed top-0 left-0 right-0 z-[10000] h-[3px] pointer-events-none"
    :class="{ 'is-active': loader.visible }"
    role="progressbar"
    :aria-busy="loader.visible"
    :aria-valuenow="Math.round(loader.progress)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="global-loader__indeterminate" />
    <div class="global-loader__bar" :style="{ transform: `scaleX(${loader.progress / 100})` }" />
  </div>
</template>

<style scoped>
.global-loader {
  opacity: 0;
  visibility: hidden;
  transform: translateY(-100%);
  transition:
    opacity 260ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0s linear 260ms;
}

.global-loader.is-active {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    visibility 0s linear 0s;
}

/* 轨道：与站点 Notion 风格一致的柔和底色 */
.global-loader::before {
  content: '';
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--theme-accent) 14%, transparent);
}

/* 未确定态：循环扫光，提供「正在处理」的感知 */
.global-loader__indeterminate {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: 0.6;
}

.global-loader__indeterminate::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 38%;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--theme-accent) 45%, transparent),
    transparent
  );
  animation: global-loader-sweep 1.1s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}

/* 确定态：进度填充，颜色跟随站点主题色 */
.global-loader__bar {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--theme-accent) 65%, transparent),
    var(--theme-accent)
  );
  box-shadow: 0 0 6px color-mix(in srgb, var(--theme-accent) 45%, transparent);
  will-change: transform;
  transition: transform 120ms linear;
}

@keyframes global-loader-sweep {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(365%);
  }
}

/* 无障碍：降低动态效果 */
@media (prefers-reduced-motion: reduce) {
  .global-loader__indeterminate::after {
    animation: none;
    opacity: 0;
  }

  .global-loader__bar {
    transition: none;
  }
}
</style>
