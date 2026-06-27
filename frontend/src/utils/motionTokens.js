/**
 * Motion Tokens - 统一动画配置系统
 *
 * 基于 motion-ui skill 最佳实践，提供一致的动画参数
 * 所有动画效果都应引用此处的配置，确保视觉一致性
 */

export const motionTokens = {
  // 动画时长
  duration: {
    fast: 0.18,      // 快速反馈（按钮、复选框）
    normal: 0.35,    // 常规过渡（卡片、面板）
    slow: 0.6        // 大型动画（页面切换、弹窗）
  },

  // 缓动曲线
  easing: {
    smooth: [0.22, 1, 0.36, 1],    // 平滑曲线（入场动画）
    sharp: [0.4, 0, 0.2, 1],       // 锐利曲线（退场动画）
    bounce: [0.34, 1.56, 0.64, 1]  // 弹性效果（强调动画）
  },

  // 位移距离
  distance: {
    sm: 8,   // 小距离（按钮、标签）
    md: 16,  // 中距离（卡片、列表项）
    lg: 24   // 大距离（页面、弹窗）
  },

  // 缩放比例
  scale: {
    press: 0.97,   // 按下效果
    hover: 1.02,   // 悬停效果
    subtle: 0.95   // 微妙缩放（弹窗等）
  }
}

/**
 * 将缓动曲线数组转换为 CSS cubic-bezier 字符串
 * @param {number[]} curve - [x1, y1, x2, y2] 格式的缓动曲线
 * @returns {string} CSS cubic-bezier 字符串
 */
export function toCubicBezier(curve) {
  return `cubic-bezier(${curve.join(', ')})`
}

/**
 * 获取动画持续时间（秒）
 * @param {'fast' | 'normal' | 'slow'} speed - 速度级别
 * @returns {number} 持续时间（秒）
 */
export function getDuration(speed = 'normal') {
  return motionTokens.duration[speed] || motionTokens.duration.normal
}

/**
 * GSAP 专用的缓动字符串映射
 */
export const gsapEasing = {
  smooth: 'power3.out',
  sharp: 'power2.inOut',
  bounce: 'back.out(1.7)'
}
