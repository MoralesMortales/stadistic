<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ventanillaSrc from '@/assets/ventanillaOpen.png'
import carSrc from '@/assets/car.png'

const modal = ref(false)
const activeTab = ref('results') // 'results' o 'stats'

// Variables de simulación
const simulationTime = ref(9 * 60) // 9:00 AM en minutos
const simulationRunning = ref(false)
const customerData = ref([])
const queue = ref([])
const currentCustomer = ref(null)
const servedCustomers = ref(0)
const rejectedCustomers = ref(0)
const customerIdCounter = ref(1)

// Configuración - 16 horas en 16 segundos
const simulationDuration = 16 * 60 // 16 horas en minutos
const realTimeDuration = 16000 // 16 segundos en milisegundos

// Nuevos parámetros
const minServiceTime = 5
const maxServiceTime = 30
const maxQueueLength = 6 // Límite de 6 carros en cola
const rejectionProbability = 0.1 // 10% de probabilidad de rechazo

// Configuración de llegadas - 1 a 40 clientes por hora
const minCustomersPerHour = 1
const maxCustomersPerHour = 40
const currentArrivalRate = ref(20) // Tasa actual de llegadas por hora

// Referencias para intervalos
let simulationInterval = null
let customerArrivalInterval = null

// Computed para estadísticas
const averageServiceTime = computed(() => {
  const served = customerData.value.filter(c => c.served && c.serviceTime > 0)
  return served.length > 0 ? served.reduce((sum, c) => sum + c.serviceTime, 0) / served.length : 0
})

const averageQueueTime = computed(() => {
  const queued = customerData.value.filter(c => c.queueTime > 0)
  return queued.length > 0 ? queued.reduce((sum, c) => sum + c.queueTime, 0) / queued.length : 0
})

const averageCustomersPerHour = computed(() => {
  const totalHours = simulationDuration / 60
  return totalHours > 0 ? customerData.value.length / totalHours : 0
})

const averageCustomersPerDay = computed(() => {
  return customerData.value.length
})

// Formatear tiempo
const formatTime = (minutes) => {
  const hours = Math.floor(minutes / 60)
  const mins = Math.floor(minutes % 60)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours > 12 ? hours - 12 : hours
  return `${displayHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${period}`
}

// Calcular tiempo entre llegadas basado en la tasa por hora
const getInterArrivalTime = () => {
  const customersPerMinute = currentArrivalRate.value / 60
  const meanInterArrivalTime = 1 / customersPerMinute
  const realTimeMs = (meanInterArrivalTime / simulationDuration) * realTimeDuration
  const variability = 0.3
  const variedTime = realTimeMs * (1 + (Math.random() - 0.5) * 2 * variability)
  return Math.max(50, variedTime)
}

// Variar la tasa de llegadas durante el día
const updateArrivalRate = () => {
  const currentHour = Math.floor(simulationTime.value / 60) % 24
  
  if (currentHour >= 9 && currentHour < 11) {
    currentArrivalRate.value = 20 + Math.random() * 20
  } else if (currentHour >= 11 && currentHour < 14) {
    currentArrivalRate.value = 30 + Math.random() * 10
  } else if (currentHour >= 14 && currentHour < 17) {
    currentArrivalRate.value = 15 + Math.random() * 15
  } else if (currentHour >= 17 && currentHour < 20) {
    currentArrivalRate.value = 25 + Math.random() * 15
  } else {
    currentArrivalRate.value = 1 + Math.random() * 14
  }
  
  currentArrivalRate.value = Math.max(minCustomersPerHour, 
                                     Math.min(maxCustomersPerHour, currentArrivalRate.value))
}

// Generar tiempo de servicio aleatorio entre 5-30 minutos
const getRandomServiceTime = () => {
  return Math.random() * (maxServiceTime - minServiceTime) + minServiceTime
}

// Iniciar simulación
const startSimulation = () => {
  customerData.value = []
  queue.value = []
  currentCustomer.value = null
  servedCustomers.value = 0
  rejectedCustomers.value = 0
  customerIdCounter.value = 1
  simulationTime.value = 9 * 60
  simulationRunning.value = true
  modal.value = false
  currentArrivalRate.value = 20

  if (simulationInterval) clearInterval(simulationInterval)
  if (customerArrivalInterval) clearInterval(customerArrivalInterval)

  simulationInterval = setInterval(updateSimulation, 100)
  scheduleNextCustomer()
}

// Programar próximo cliente
const scheduleNextCustomer = () => {
  if (customerArrivalInterval) clearInterval(customerArrivalInterval)
  
  const nextArrivalTime = getInterArrivalTime()
  
  customerArrivalInterval = setTimeout(() => {
    if (simulationRunning.value && simulationTime.value < (9 * 60 + simulationDuration)) {
      generateCustomer()
      scheduleNextCustomer()
    }
  }, nextArrivalTime)
}

// Generar nuevo cliente
const generateCustomer = () => {
  const newCustomer = {
    id: customerIdCounter.value++,
    arrivalTime: simulationTime.value,
    queueTime: 0,
    serviceTime: 0,
    served: false,
    departureTime: null,
    position: -100,
    moving: false,
    requiredServiceTime: 0,
    queuePosition: -1
  }

  // Verificar si hay espacio en la cola (máximo 6 carros)
  if (queue.value.length >= maxQueueLength) {
    // Cola llena - cliente rechazado
    newCustomer.served = false
    newCustomer.departureTime = simulationTime.value
    rejectedCustomers.value++
    animateCustomerRejection(newCustomer)
  } else if (Math.random() < rejectionProbability) {
    // Rechazo aleatorio
    newCustomer.served = false
    newCustomer.departureTime = simulationTime.value
    rejectedCustomers.value++
    animateCustomerRejection(newCustomer)
  } else {
    // Agregar a la cola
    newCustomer.queuePosition = queue.value.length
    queue.value.push(newCustomer)
    updateQueuePositions()
  }

  customerData.value.push(newCustomer)
}

// Animar rechazo de cliente
const animateCustomerRejection = (customer) => {
  customer.moving = true
  customer.position = 50
  
  setTimeout(() => {
    customer.position = -100
    customer.moving = false
  }, 300)
}

// Actualizar posiciones de la cola - EVITAR SUPERPOSICIÓN
const updateQueuePositions = () => {
  queue.value.forEach((car, index) => {
    car.queuePosition = index
    const targetPosition = 100 + index * 90 // Más espacio entre carros (90px en lugar de 80px)
    const targetBottom = 20 + index * 15 // Espacio vertical para evitar superposición
    
    if (Math.abs(car.position - targetPosition) > 5) {
      car.moving = true
      car.position = targetPosition
      car.bottom = targetBottom
      setTimeout(() => {
        car.moving = false
      }, 300)
    }
  })
}

// Mover cliente a la ventanilla - ALINEAR CON LA TAQUILLA
const moveToVentanilla = (customer) => {
  customer.moving = true
  customer.position = 450 // Posición alineada con la taquilla
  customer.bottom = 20 // Misma altura que la taquilla
  
  setTimeout(() => {
    customer.moving = false
  }, 400)
}

// Actualizar simulación
const updateSimulation = () => {
  if (!simulationRunning.value) return

  simulationTime.value += 6
  updateArrivalRate()

  if (currentCustomer.value) {
    currentCustomer.value.serviceTime += 6
    
    if (currentCustomer.value.serviceTime >= currentCustomer.value.requiredServiceTime) {
      currentCustomer.value.departureTime = simulationTime.value
      currentCustomer.value.served = true
      servedCustomers.value++
      
      currentCustomer.value.moving = true
      currentCustomer.value.position = 800
      
      setTimeout(() => {
        currentCustomer.value = null
        processNextCustomer()
      }, 300)
    }
  } else {
    processNextCustomer()
  }

  queue.value.forEach(customer => {
    customer.queueTime += 6
  })

  if (simulationTime.value >= (9 * 60 + simulationDuration)) {
    endSimulation()
  }
}

// Procesar siguiente cliente
const processNextCustomer = () => {
  if (queue.value.length > 0 && !currentCustomer.value) {
    currentCustomer.value = queue.value.shift()
    currentCustomer.value.requiredServiceTime = getRandomServiceTime()
    moveToVentanilla(currentCustomer.value)
    updateQueuePositions()
  }
}

// Finalizar simulación
const endSimulation = () => {
  simulationRunning.value = false
  if (simulationInterval) clearInterval(simulationInterval)
  if (customerArrivalInterval) clearInterval(customerArrivalInterval)
  
  queue.value.forEach(customer => {
    customer.served = false
    customer.departureTime = simulationTime.value
  })
  
  setTimeout(() => {
    modal.value = true
  }, 500)
}

onUnmounted(() => {
  if (simulationInterval) clearInterval(simulationInterval)
  if (customerArrivalInterval) clearInterval(customerArrivalInterval)
})
</script>

<template>
  <div id="container">
    <div id="header">
      <div id="timeBox">
        <h2 class="txt">Tiempo</h2>
        <h3 class="txt">{{ formatTime(simulationTime) }}</h3>
        <h4 class="txt" v-if="simulationRunning" style="color: #ff6b6b; margin-top: 10px;">
          Simulación acelerada: 16 horas en 16 segundos
        </h4>
        <h4 class="txt" v-if="simulationRunning" style="color: #4ecdc4; margin-top: 5px; font-size: 16px;">
          Tasa actual: {{ Math.round(currentArrivalRate) }} clientes/hora
        </h4>
      </div>
      <div id="simulationInfo">
        <h3 class="txt">Clientes atendidos: {{ servedCustomers }}</h3>
        <h3 class="txt">Clientes en cola: {{ queue.length }}/{{ maxQueueLength }}</h3>
        <h3 class="txt">Clientes rechazados: {{ rejectedCustomers }}</h3>
        <h3 class="txt">Total clientes: {{ customerData.length }}</h3>
        <h3 class="txt" style="color: #4ecdc4;">
          Tasa de llegada: {{ Math.round(currentArrivalRate) }}/hora
        </h3>
      </div>
    </div>
    <div id="body">
      <div id="noRoad">
        <div id="leftRoad">
          <!-- Carros en cola -->
          <img 
            v-for="car in queue" 
            :key="car.id"
            :src="carSrc" 
            class="car" 
            :alt="`Carro ${car.id}`"
            :style="{ 
              left: car.position + 'px',
              bottom: car.bottom + 'px',
              transition: car.moving ? 'left 0.3s ease-in-out, bottom 0.3s ease-in-out' : 'none',
              opacity: car.moving ? 0.8 : 1,
              zIndex: 10 + car.queuePosition
            }" 
          />
        </div>
 
        <div id="rightRoad">
          <img :src="ventanillaSrc" id="ventanilla" alt="Ventanilla" />
          <!-- Carro en servicio -->
          <img 
            v-if="currentCustomer"
            :src="carSrc" 
            id="carService" 
            :alt="`Carro ${currentCustomer.id} en servicio`"
            :style="{ 
              left: currentCustomer.position + 'px',
              bottom: currentCustomer.bottom + 'px',
              transition: currentCustomer.moving ? 'left 0.3s ease-in-out, bottom 0.3s ease-in-out' : 'none',
              opacity: currentCustomer.moving ? 0.8 : 1,
              zIndex: 20
            }" 
          />
        </div>
      </div>
      <div id="road"></div>
    </div>
    <div id="bottom">
      <button type="submit" @click="startSimulation" id="btn" :disabled="simulationRunning">
        {{ simulationRunning ? 'Simulación en curso...' : 'Hacer Análisis' }}
      </button>
      <p style="color: white; margin-top: 10px; font-size: 14px;">
        La simulación completará 16 horas (9am-11pm) en 16 segundos
      </p>
      <p style="color: #4ecdc4; margin-top: 5px; font-size: 12px;">
        Límite de cola: {{ maxQueueLength }} carros | Servicio: {{ minServiceTime }}-{{ maxServiceTime }} min
      </p>
    </div>

    <q-dialog v-model="modal" persistent>
      <q-card style="width: 900px; max-width: 95vw;">
        <q-card-section>
          <div class="text-h6">Resultados de la Simulación - 16 Horas en 16 Segundos</div>
        </q-card-section>

        <q-tabs v-model="activeTab" class="text-teal">
          <q-tab name="results" label="Resultados Detallados" />
          <q-tab name="stats" label="Estadísticas" />
        </q-tabs>

        <q-tab-panels v-model="activeTab" animated>
          <q-tab-panel name="results">
            <q-card-section class="q-pt-none">
              <div style="max-height: 400px; overflow-y: auto;">
                <table class="results-table">
                  <thead>
                    <tr>
                      <th>Nro Cliente</th>
                      <th>Hora de Llegada</th>
                      <th>Tiempo en Cola (min)</th>
                      <th>Tiempo en Caja (min)</th>
                      <th>Atendido</th>
                      <th>Hora de Salida</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="customer in customerData" :key="customer.id">
                      <td>{{ customer.id }}</td>
                      <td>{{ formatTime(customer.arrivalTime) }}</td>
                      <td>{{ customer.queueTime.toFixed(2) }}</td>
                      <td>{{ customer.serviceTime.toFixed(2) }}</td>
                      <td>
                        <span :class="customer.served ? 'served' : 'not-served'">
                          {{ customer.served ? 'Sí' : 'No' }}
                        </span>
                      </td>
                      <td>{{ customer.departureTime ? formatTime(customer.departureTime) : 'N/A' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </q-card-section>
          </q-tab-panel>

          <q-tab-panel name="stats">
            <q-card-section class="q-pt-none">
              <div class="stats-container">
                <div class="stat-item">
                  <h4>Resumen General</h4>
                  <p><strong>Total de clientes:</strong> {{ customerData.length }}</p>
                  <p><strong>Clientes atendidos:</strong> {{ servedCustomers }}</p>
                  <p><strong>Clientes rechazados:</strong> {{ rejectedCustomers }}</p>
                  <p><strong>Tasa de servicio:</strong> {{ ((servedCustomers / customerData.length) * 100 || 0).toFixed(2) }}%</p>
                  <p><strong>Clientes por hora (promedio):</strong> {{ averageCustomersPerHour.toFixed(2) }}</p>
                </div>
                
                <div class="stat-item">
                  <h4>Tiempos Promedio</h4>
                  <p><strong>Tiempo medio de servicio:</strong> {{ averageServiceTime.toFixed(2) }} minutos</p>
                  <p><strong>Tiempo medio en cola:</strong> {{ averageQueueTime.toFixed(2) }} minutos</p>
                  <p><strong>Tiempo máximo en cola:</strong> {{ Math.max(...customerData.map(c => c.queueTime)).toFixed(2) }} minutos</p>
                </div>
                
                <div class="stat-item">
                  <h4>Eficiencia del Sistema</h4>
                  <p><strong>Eficiencia de atención:</strong> {{ ((servedCustomers / (servedCustomers + rejectedCustomers)) * 100 || 0).toFixed(2) }}%</p>
                  <p><strong>Utilización de la caja:</strong> {{ ((servedCustomers * averageServiceTime / simulationDuration) * 100 || 0).toFixed(2) }}%</p>
                  <p><strong>Rechazos por cola llena:</strong> {{ customerData.filter(c => !c.served && c.queueTime === 0).length }}</p>
                </div>
              </div>
            </q-card-section>
          </q-tab-panel>
        </q-tab-panels>

        <q-card-actions align="right" class="bg-white text-teal">
          <q-btn flat label="Cerrar" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
#container{
  background-color: #222;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

#header{
  height: 30%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
}

#timeBox{
  padding: 40px 40px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 10%;
  justify-content: center;
  align-items: center;
}

#timeBox > h2{
  font-size: 30px;
}

#timeBox > h3{
  font-size: 28px;
}

#simulationInfo {
  color: white;
  text-align: right;
}

#simulationInfo h3 {
  margin: 5px 0;
  font-size: 18px;
}

#body{
  height: 50%;
  display: flex;
  flex-direction: column;
}

#ventanilla{
  object-fit: contain;
  width: 150px; /* Tamaño fijo para mejor alineación */
  position: absolute;
  bottom: 20px; /* Alineado con los carros */
  right: 50px;
  z-index: 5;
}

.car {
  object-fit: contain;
  width: 80px; /* Tamaño fijo para consistencia */
  height: 40px;
  position: absolute;
  z-index: 10;
  transition: left 0.3s ease-in-out, bottom 0.3s ease-in-out;
}

#carService {
  object-fit: contain;
  width: 80px;
  height: 40px;
  position: absolute;
  z-index: 20;
  transition: left 0.3s ease-in-out, bottom 0.3s ease-in-out;
}

#noRoad{
  height: 90%;
  position: relative;
  margin-right: 40px;
}

#road{
  height: 10%;
  background-color: #000;
}

#btn:hover:not(:disabled){
  background-color: #A9A9A9;
  cursor: pointer;
}

#btn:disabled {
  background-color: #666;
  cursor: not-allowed;
}

#bottom{
  height: 30%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

#btn{
  background-color: #D9D9D9;
  border-radius: 12px;
  height: 30%;
  width: 300px;
  color: #000;
  font-size: 24px;
  border: none;
}

*{
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.txt{
  color: #fff;
}

#leftRoad{
  position: relative;
  height: 100%;
  width: 70%;
}

#rightRoad{
  position: relative;
  height: 100%;
  width: 30%;
}

/* Estilos para la tabla de resultados */
.results-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.results-table th,
.results-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
  font-size: 12px;
}

.results-table th {
  background-color: #f2f2f2;
  position: sticky;
  top: 0;
}

.results-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.served {
  color: #28a745;
  font-weight: bold;
}

.not-served {
  color: #dc3545;
  font-weight: bold;
}

/* Estilos para estadísticas */
.stats-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stat-item {
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #fafafa;
}

.stat-item h4 {
  margin-bottom: 10px;
  color: #1976d2;
}

.stat-item p {
  margin: 5px 0;
}

.queue-full {
  color: #ff6b6b;
  font-weight: bold;
}
</style>
