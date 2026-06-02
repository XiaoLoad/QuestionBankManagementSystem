import { useToastStore } from '@/stores/toast'

async function request(url, options = {}) {
  const toast = useToastStore()

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    const data = await res.json()
    if (!res.ok) {
      const msg = data.error || data.message || '请求失败'
      toast.error(msg)
      throw { status: res.status, data }
    }
    return data
  } catch (err) {
    if (err.name === 'AbortError') return // Silently ignore cancelled requests
    if (err.status) throw err
    toast.error('网络错误，请检查连接')
    throw err
  }
}

export function useApi() {
  return {
    // Questions
    getQuestions: (params = {}) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v)
      })
      return request(`/api/questions?${qs}`)
    },
    getQuestion: (id) => request(`/api/questions/${id}`),
    createQuestion: (body) => request('/api/questions', { method: 'POST', body: JSON.stringify(body) }),
    updateQuestion: (id, body) => request(`/api/questions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteQuestion: (id) => request(`/api/questions/${id}`, { method: 'DELETE' }),
    batchDelete: (body) => request('/api/questions/batch-delete', { method: 'POST', body: JSON.stringify(body) }),
    batchCategory: (body) => request('/api/questions/batch-category', { method: 'PUT', body: JSON.stringify(body) }),

    // Stats & Refresh
    getStats: (days) => request(`/api/stats${days ? `?days=${days}` : ''}`),
    refresh: () => request('/api/refresh'),

    // Categories
    getCategories: () => request('/api/categories'),
    createCategory: (name, score) => request('/api/categories', { method: 'POST', body: JSON.stringify({ name, score }) }),
    updateCategory: (id, nameOrBody) => {
      const body = typeof nameOrBody === 'object' ? nameOrBody : { name: nameOrBody };
      return request(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    moveCategory: (id, target) => request(`/api/categories/${id}/move`, { method: 'POST', body: JSON.stringify({ target }) }),
    deleteCategory: (id, confirm) => request(`/api/categories/${id}`, { method: 'DELETE', body: JSON.stringify({ confirm }) }),

    // Backup
    downloadBackup: () => {
      window.open('/api/backup', '_blank')
    },
    exportJson: (params = {}) => {
      const toast = useToastStore()
      fetch('/api/backup/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
        .then(res => {
          if (!res.ok) return res.json().then(d => { throw d })
          return res.blob()
        })
        .then(blob => {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `questions-export-${new Date().toISOString().slice(0, 10)}.json`
          a.click()
          URL.revokeObjectURL(url)
          toast.success('导出成功')
        })
        .catch(err => {
          toast.error(err.error || '导出失败')
        })
    },
    importJson: (questions, categoryScores) => request('/api/backup/import', { method: 'POST', body: JSON.stringify({ questions, categoryScores }) }),
    previewImport: (questions) => request('/api/backup/import/preview', { method: 'POST', body: JSON.stringify({ questions }) }),
    resolveImportConflicts: (updates) => request('/api/backup/import/resolve', { method: 'POST', body: JSON.stringify({ updates }) }),

    // Trash
    getTrash: (params = {}) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v)
      })
      return request(`/api/trash?${qs}`)
    },
    getTrashCount: () => request('/api/trash/count'),
    restoreTrash: (id, force = false) => request(`/api/trash/${id}/restore`, { method: 'POST', body: JSON.stringify({ force }) }),
    batchRestoreTrash: (body) => request('/api/trash/batch-restore', { method: 'POST', body: JSON.stringify(body) }),
    permanentDeleteTrash: (id) => request(`/api/trash/${id}`, { method: 'DELETE' }),
    batchPermanentDeleteTrash: (body) => request('/api/trash/batch-delete', { method: 'POST', body: JSON.stringify(body) }),
    emptyTrash: () => request('/api/trash/empty', { method: 'POST' }),

    // AI
    getAiPresets: () => request('/api/ai/presets'),
    getAiProviders: () => request('/api/ai/providers'),
    createAiProvider: (body) => request('/api/ai/providers', { method: 'POST', body: JSON.stringify(body) }),
    updateAiProvider: (id, body) => request(`/api/ai/providers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteAiProvider: (id) => request(`/api/ai/providers/${id}`, { method: 'DELETE' }),
    testAiProvider: (id) => request(`/api/ai/providers/${id}/test`, { method: 'POST' }),
    getAiModels: (id) => request(`/api/ai/providers/${id}/models`),
    analyzeQuestion: (body) => {
      const timeout = parseInt(localStorage.getItem('ai_timeout') || '120') * 1000
      return request('/api/ai/analyze', { method: 'POST', body: JSON.stringify({ ...body, timeout }) })
    },

    // Duplicates
    getDuplicates: () => request('/api/duplicates'),
    resolveDuplicates: (body) => request('/api/duplicates/resolve', { method: 'POST', body: JSON.stringify(body) }),

    // External Banks
    getExternalConfig: () => request('/api/external/config'),
    updateExternalConfig: (body) => request('/api/external/config', { method: 'PUT', body: JSON.stringify(body) }),
    getExternalStats: () => request('/api/external/stats'),
    getExternalLogs: (params = {}) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v)
      })
      return request(`/api/external/logs?${qs}`)
    },
    clearExternalLogs: (days) => request('/api/external/logs', { method: 'DELETE', body: JSON.stringify({ days }) }),

    // Database
    getDatabase: () => request('/api/database'),
    switchDatabase: (dbPath) => request('/api/database/switch', { method: 'POST', body: JSON.stringify({ dbPath }) }),
    createDatabase: (dbPath) => request('/api/database/create', { method: 'POST', body: JSON.stringify({ dbPath }) }),
    resetDatabase: () => request('/api/database/reset', { method: 'POST' }),
    removeRecentDb: (dbPath) => request('/api/database/recent', { method: 'DELETE', body: JSON.stringify({ dbPath, deleteFile: true }) }),
    getTargetDir: () => request('/api/database/target-dir'),
    setTargetDir: (dir) => request('/api/database/target-dir', { method: 'PUT', body: JSON.stringify({ dir }) }),
    getAvailableDatabases: () => request('/api/database/available'),
    deployDatabase: (sourcePath, fileName, overwrite) => request('/api/database/deploy', { method: 'POST', body: JSON.stringify({ sourcePath, fileName, overwrite }) }),
    uploadDatabase: async (file, desiredName) => {
      const toast = useToastStore()
      const formData = new FormData()
      formData.append('file', file)
      const url = desiredName ? `/api/database/upload?desiredName=${encodeURIComponent(desiredName)}` : '/api/database/upload'
      try {
        const res = await fetch(url, { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || '上传失败')
          throw { status: res.status, data }
        }
        return data
      } catch (err) {
        if (err.status) throw err
        toast.error('网络错误，请检查连接')
        throw err
      }
    },
  }
}
