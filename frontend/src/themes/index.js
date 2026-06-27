/**
 * 主题配置文件
 * 定义所有可用的主题配色方案
 */

export const themes = {
  // 默认主题 - Notion 紫
  purple: {
    id: 'purple',
    name: '经典紫',
    description: 'Notion 风格的优雅紫色',
    preview: '#5645d4',
    light: {
      bg: '#ffffff',
      surface: '#f7f6f3',
      text: '#37352f',
      border: '#e5e3df',
      accent: '#5645d4',
      muted: '#9b9a97',
    },
    dark: {
      bg: '#191919',
      surface: '#202020',
      text: '#e8e6e3',
      border: '#333333',
      accent: '#7c6ef0',
      muted: '#6b6b6b',
    },
  },

  // 护眼绿 - 适合长时间刷题
  green: {
    id: 'green',
    name: '护眼绿',
    description: '柔和的绿色，适合长时间阅读',
    preview: '#4caf50',
    light: {
      bg: '#f8fdf8',
      surface: '#e8f5e9',
      text: '#2e3b2e',
      border: '#c8e6c9',
      accent: '#4caf50',
      muted: '#7cb680',
    },
    dark: {
      bg: '#1a2419',
      surface: '#223322',
      text: '#e0ece0',
      border: '#3a5a3a',
      accent: '#66bb6a',
      muted: '#5a7a5a',
    },
  },

  // 温暖橙棕
  orange: {
    id: 'orange',
    name: '温暖橙',
    description: '温暖的橙棕色，舒适护眼',
    preview: '#e67e22',
    light: {
      bg: '#fdf8f4',
      surface: '#f5ebe0',
      text: '#3d2e1e',
      border: '#e6d5c3',
      accent: '#e67e22',
      muted: '#a89080',
    },
    dark: {
      bg: '#241c14',
      surface: '#2d2318',
      text: '#ece0d4',
      border: '#5a4a3a',
      accent: '#f0a050',
      muted: '#8a7a6a',
    },
  },

  // 专业蓝
  blue: {
    id: 'blue',
    name: '专业蓝',
    description: '清爽的蓝色，专业稳重',
    preview: '#2196f3',
    light: {
      bg: '#f8fafd',
      surface: '#e3ecf6',
      text: '#1e2d3d',
      border: '#c3d5e6',
      accent: '#2196f3',
      muted: '#7a8ea0',
    },
    dark: {
      bg: '#141c24',
      surface: '#1a2634',
      text: '#dce8f0',
      border: '#3a5068',
      accent: '#42a5f5',
      muted: '#5a7a90',
    },
  },

  // 优雅粉
  pink: {
    id: 'pink',
    name: '优雅粉',
    description: '柔和的粉色，温馨优雅',
    preview: '#e91e63',
    light: {
      bg: '#fdf8fa',
      surface: '#fce4ec',
      text: '#3d2e35',
      border: '#f8bbd0',
      accent: '#e91e63',
      muted: '#a07a8a',
    },
    dark: {
      bg: '#24141c',
      surface: '#2d1a24',
      text: '#ece0e8',
      border: '#5a3a4a',
      accent: '#f06292',
      muted: '#8a5a70',
    },
  },

  // 深靛蓝 - 现代感
  indigo: {
    id: 'indigo',
    name: '深靛蓝',
    description: '现代感的靛蓝色',
    preview: '#3f51b5',
    light: {
      bg: '#f5f7fa',
      surface: '#e8ecf4',
      text: '#1a2332',
      border: '#c5cfe0',
      accent: '#3f51b5',
      muted: '#6b7a90',
    },
    dark: {
      bg: '#141824',
      surface: '#1a2030',
      text: '#dce0ec',
      border: '#3a4560',
      accent: '#7986cb',
      muted: '#5a6a80',
    },
  },
}

/**
 * 获取所有主题列表
 * @returns {Array} 主题配置数组
 */
export function getAllThemes() {
  return Object.values(themes)
}

/**
 * 根据 ID 获取主题
 * @param {string} themeId - 主题 ID
 * @returns {Object} 主题配置
 */
export function getThemeById(themeId) {
  return themes[themeId] || themes.purple
}

/**
 * 应用主题到 DOM
 * @param {string} themeId - 主题 ID
 * @param {boolean} isDark - 是否暗色模式
 */
export function applyTheme(themeId, isDark) {
  const theme = getThemeById(themeId)
  const colors = isDark ? theme.dark : theme.light
  const root = document.documentElement

  // 设置主题 class
  root.className = root.className.replace(/theme-\w+/g, '')
  root.classList.add(`theme-${themeId}`)

  // 应用 CSS 变量
  root.style.setProperty('--theme-bg', colors.bg)
  root.style.setProperty('--theme-surface', colors.surface)
  root.style.setProperty('--theme-text', colors.text)
  root.style.setProperty('--theme-border', colors.border)
  root.style.setProperty('--theme-accent', colors.accent)
  root.style.setProperty('--theme-muted', colors.muted)
}
