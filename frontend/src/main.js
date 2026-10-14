import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { useLoaderStore } from './stores/loader'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// 全局加载条：组件外可直接使用 window.$loader.show() / .hide()
app.config.globalProperties.$loader = useLoaderStore()
window.$loader = app.config.globalProperties.$loader

app.mount('#app')
