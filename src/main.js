import { createApp } from 'vue'
import App from './App.vue'
import { Quasar } from 'quasar'

// Importa los iconos y estilos
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'

const app = createApp(App)

app.use(Quasar, {
  plugins: {}, // Agrega plugins de Quasar aquí si los necesitas
})

app.mount('#app')
