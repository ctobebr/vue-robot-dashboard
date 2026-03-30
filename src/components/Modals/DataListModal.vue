<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('dataList')"
    width="600px"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    @close="onClose"
  >
    <el-table :data="paginationData" stripe style="width: 100%">
      <el-table-column :label="t('index')" width="80" min-width="80">
        <template #default="scope">
          {{ (pagination.current - 1) * pagination.pageSize + scope.$index + 1 }}
        </template>
      </el-table-column>
      <el-table-column :label="t('dataName')" prop="name" />
      <el-table-column :label="t('createdTime')" width="180">
        <template #default="scope">
          {{ dayjs(scope.row.createdTime).format('YYYY-MM-DD HH:mm:ss') }}
        </template>
      </el-table-column>
      <el-table-column :label="t('operation')" width="150">
        <template #default="scope">
          <div class="operation-buttons">
            <template v-if="loadingStates[scope.row.name]">
              <div class="progress-container">
                <el-progress
                  type="circle"
                  :percentage="compressProgressStates[scope.row.name] || 0"
                  :width="36"
                  :stroke-width="6"
                  color="#eab308"
                />
                <div class="progress-info">
                  <span class="progress-percent">{{ compressProgressStates[scope.row.name] || 0 }}%</span>
                  <span v-if="compressSpeedStates[scope.row.name] > 0" class="progress-speed">
                    {{ compressSpeedStates[scope.row.name] }} MB/s
                  </span>
                </div>
              </div>
            </template>
            <template v-else>
              <el-button
                type="primary"
                size="small"
                circle
                @click="handleDownloadData(scope.row.name)"
              >
                <PhDownload size="14" />
              </el-button>
            </template>
            <el-button
              type="danger"
              size="small"
              circle
              @click="handleDeleteDataModal(scope.row.name)"
            >
              <PhTrash size="14" />
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.current"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[6, 10, 20]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { saveAs } from 'file-saver'
import { useSocket } from '@/composables/useSocket'
import { deviceAPI } from '@/services/api'
import { ElMessageBox } from 'element-plus'
import { PhDownload, PhTrash } from '@phosphor-icons/vue'

const { t } = useI18n()
const { socket } = useSocket()

const props = defineProps({
  opened: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const dialogVisible = ref(false)
const allData = ref([])
const pagination = ref({
  current: 1,
  pageSize: 6,
  total: 0
})
const paginationData = ref([])
const loadingStates = ref({})
const compressProgressStates = ref({})
const compressSpeedStates = ref({})

const socketListeners = {}

async function fetchFileData() {
  try {
    const response = await deviceAPI.getDataDetails()
    const files = []

    response.data.data.forEach((item) => {
      const name = item.name
      const size = item.size
      const dateTimeStr = name.slice(0, 14)
      let createdTime = ''

      if (/^\d{14}$/.test(dateTimeStr)) {
        const year = dateTimeStr.slice(0, 4)
        const month = dateTimeStr.slice(4, 6)
        const day = dateTimeStr.slice(6, 8)
        const hour = dateTimeStr.slice(8, 10)
        const minute = dateTimeStr.slice(10, 12)
        const second = dateTimeStr.slice(12, 14)
        createdTime = `${year}-${month}-${day} ${hour}:${minute}:${second}`
      }

      files.push({ name, createdTime, size })
    })

    files.sort((a, b) => dayjs(b.createdTime).valueOf() - dayjs(a.createdTime).valueOf())
    allData.value = files.map((item) => item.name)
    return files
  } catch (error) {
    console.error('Failed to fetch file data:', error)
    return []
  }
}

function updatePaginationData(files) {
  const start = (pagination.value.current - 1) * pagination.value.pageSize
  const end = start + pagination.value.pageSize
  paginationData.value = files.slice(start, end)
}

async function refreshDataList() {
  const files = await fetchFileData()
  pagination.value.total = files.length
  updatePaginationData(files)
}

function handleSizeChange(size) {
  pagination.value.pageSize = size
  refreshDataList()
}

function handleCurrentChange(page) {
  pagination.value.current = page
  refreshDataList()
}

function onClose() {
  emit('close')
}

function handleDeleteDataModal(name) {
  ElMessageBox.confirm(
    `${t('dataName')}: ${name}`,
    t('confirmDeleteData'),
    {
      confirmButtonText: t('confirm'),
      cancelButtonText: t('cancel'),
      type: 'warning'
    }
  ).then(() => {
    deleteData(name)
  }).catch(() => {})
}

async function deleteData(name) {
  try {
    const res = await deviceAPI.deleteData([name])
    if (res.status === 200) {
      await refreshDataList()
    }
  } catch (err) {
    console.error('Delete error:', err)
  }
}

async function handleDownloadData(name) {
  loadingStates.value[name] = true
  compressProgressStates.value[name] = 0
  compressSpeedStates.value[name] = 0

  const compressHandler = (data) => {
    compressProgressStates.value[name] = data.percent
    compressSpeedStates.value[name] = data.speedMB
  }

  const compressCompleteHandler = () => {
    compressProgressStates.value[name] = 100
    cleanupSocketListeners(name)
  }

  socketListeners[name] = { compressHandler, compressCompleteHandler }

  socket.value?.on(`zip-progress-${name}`, compressHandler)
  socket.value?.on(`zip-finish-${name}`, compressCompleteHandler)

  await downloadFile(name)
}

async function downloadFile(name) {
  try {
    const res = await deviceAPI.downloadData(import.meta.env.VITE_DEVICE_SN, name)
    saveAs(res.data, `${name}.zip`)
  } catch (error) {
    console.error('Error downloading data:', error)
  } finally {
    loadingStates.value[name] = false
    compressProgressStates.value[name] = 0
    compressSpeedStates.value[name] = 0
    cleanupSocketListeners(name)
  }
}

function cleanupSocketListeners(name) {
  if (socketListeners[name]) {
    const { compressHandler, compressCompleteHandler } = socketListeners[name]
    socket.value?.off(`zip-progress-${name}`, compressHandler)
    socket.value?.off(`zip-finish-${name}`, compressCompleteHandler)
    delete socketListeners[name]
  }
}

watch(() => props.opened, async (newVal) => {
  dialogVisible.value = newVal
  if (newVal) {
    await refreshDataList()
  }
})

onUnmounted(() => {
  Object.keys(socketListeners).forEach(name => {
    cleanupSocketListeners(name)
  })
})
</script>

<style scoped>
:deep(.el-dialog) {
  width: 90% !important;
  max-width: 600px;
  margin: 5vh auto !important;
}

.operation-buttons {
  display: flex;
  gap: var(--base-spacing-sm, 8px);
  align-items: center;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: var(--base-spacing-sm, 8px);
}

.progress-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.progress-percent {
  font-size: var(--font-size-sm, 12px);
  font-weight: bold;
}

.progress-speed {
  font-size: var(--font-size-xs, 10px);
  color: #666;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: var(--base-spacing, 16px);
  flex-wrap: wrap;
  gap: var(--base-spacing-sm, 8px);
}

@media screen and (max-width: 320px) {
  :deep(.el-dialog) {
    width: 95% !important;
    margin: 2vh auto !important;
  }

  .operation-buttons {
    gap: 6px;
  }

  .progress-container {
    gap: 6px;
  }

  :deep(.el-pagination) {
    font-size: 11px;
  }

  :deep(.el-pagination button) {
    min-width: 24px;
    height: 24px;
    line-height: 24px;
  }

  :deep(.el-pager li) {
    min-width: 24px;
    height: 24px;
    line-height: 24px;
    font-size: 11px;
  }
}

@media screen and (max-width: 768px) {
  :deep(.el-dialog) {
    width: 92% !important;
    margin: 3vh auto !important;
  }

  :deep(.el-dialog__body) {
    padding: 15px;
  }

  :deep(.el-dialog__header) {
    padding: 15px 15px 10px;
  }

  :deep(.el-dialog__footer) {
    padding: 10px 15px 15px;
  }

  .pagination-container {
    margin-top: 12px;
  }

  :deep(.el-table) {
    font-size: 12px;
  }

  :deep(.el-table th),
  :deep(.el-table td) {
    padding: 8px 0;
  }
}

@media screen and (min-width: 1024px) {
  :deep(.el-dialog) {
    width: 650px !important;
    max-width: 650px;
  }

  :deep(.el-dialog__body) {
    padding: 25px;
  }

  :deep(.el-dialog__header) {
    padding: 20px 25px 15px;
  }

  :deep(.el-dialog__footer) {
    padding: 15px 25px 20px;
  }

  .pagination-container {
    margin-top: 20px;
  }
}

@media screen and (min-width: 1440px) {
  :deep(.el-dialog) {
    width: 700px !important;
    max-width: 700px;
  }

  :deep(.el-dialog__body) {
    padding: 30px;
  }

  :deep(.el-dialog__header) {
    padding: 25px 30px 20px;
  }

  :deep(.el-dialog__footer) {
    padding: 20px 30px 25px;
  }

  .pagination-container {
    margin-top: 24px;
  }

  :deep(.el-table) {
    font-size: 15px;
  }

  :deep(.el-table th),
  :deep(.el-table td) {
    padding: 14px 0;
  }
}
</style>
