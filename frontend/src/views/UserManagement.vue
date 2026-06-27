<template>
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-notion-text dark:text-notion-text-dark">用户管理</h1>
        <p class="text-xs sm:text-sm text-notion-muted dark:text-notion-muted-dark mt-1">管理系统用户账号</p>
      </div>
      <button @click="showAddModal = true" class="btn-primary flex items-center gap-2 text-sm">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        添加用户
      </button>
    </div>

    <!-- Users List -->
    <div class="card p-0 overflow-hidden">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="w-8 h-8 border-2 border-notion-accent/30 border-t-notion-accent rounded-full animate-spin" />
      </div>

      <!-- Empty State -->
      <div v-else-if="users.length === 0" class="text-center py-12">
        <svg class="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-notion-muted dark:text-notion-muted-dark mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p class="text-sm text-notion-muted dark:text-notion-muted-dark">暂无用户</p>
      </div>

      <!-- PC 端：表格布局 -->
      <div v-if="!loading && users.length > 0" class="hidden sm:block overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-notion-border dark:border-notion-border-dark bg-gray-50 dark:bg-gray-800/50">
              <th class="text-left py-3 px-4 text-sm font-medium text-notion-muted dark:text-notion-muted-dark">用户名</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-notion-muted dark:text-notion-muted-dark">显示名称</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-notion-muted dark:text-notion-muted-dark">角色</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-notion-muted dark:text-notion-muted-dark">状态</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-notion-muted dark:text-notion-muted-dark">最后登录</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-notion-muted dark:text-notion-muted-dark">创建时间</th>
              <th class="text-right py-3 px-4 text-sm font-medium text-notion-muted dark:text-notion-muted-dark">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" class="border-b border-notion-border dark:border-notion-border-dark hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="py-3 px-4">
                <span class="font-medium text-notion-text dark:text-notion-text-dark">{{ user.username }}</span>
              </td>
              <td class="py-3 px-4 text-notion-text dark:text-notion-text-dark">
                {{ user.display_name || '-' }}
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span :class="user.role === 'admin' ? 'badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'">
                    {{ user.role === 'admin' ? '管理员' : '普通用户' }}
                  </span>
                  <span v-if="user.role !== 'admin' && user.restrictedCategories && user.restrictedCategories.length > 0" :class="['badge', user.restriction_mode === 'block' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400']" :title="(user.restriction_mode === 'block' ? '禁止: ' : '仅限: ') + user.restrictedCategories.join('、')">
                    {{ user.restriction_mode === 'block' ? '禁止' : '仅限' }}{{ user.restrictedCategories.length }}个分类
                  </span>
                </div>
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span :class="user.is_active ? 'badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'">
                    {{ user.is_active ? '启用' : '禁用' }}
                  </span>
                  <span v-if="isLocked(user)" class="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    已锁定
                  </span>
                </div>
              </td>
              <td class="py-3 px-4 text-sm text-notion-muted dark:text-notion-muted-dark">
                {{ user.last_login_at ? formatDate(user.last_login_at) : '从未登录' }}
              </td>
              <td class="py-3 px-4 text-sm text-notion-muted dark:text-notion-muted-dark">
                {{ formatDate(user.created_at) }}
              </td>
              <td class="py-3 px-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button v-if="isLocked(user)" @click="unlockUser(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="解锁账号">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button @click="router.push(`/users/${user.id}/logs`)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="活动日志">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </button>
                  <button @click="editUser(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-accent dark:hover:text-accent-dark hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="编辑">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button @click="showResetPassword(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="重置密码">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>
                  <button v-if="user.username !== 'admin'" @click="toggleUserStatus(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" :title="user.is_active ? '禁用' : '启用'">
                    <svg v-if="user.is_active" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button v-if="user.username !== 'admin'" @click="deleteUser(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="删除">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 移动端：卡片布局 -->
      <div v-if="!loading && users.length > 0" class="sm:hidden divide-y divide-notion-border dark:divide-notion-border-dark">
        <div v-for="user in users" :key="user.id" class="p-3">
          <div class="flex items-start justify-between mb-2">
            <div>
              <span class="font-medium text-sm text-notion-text dark:text-notion-text-dark">{{ user.username }}</span>
              <span v-if="user.display_name" class="text-xs text-notion-muted dark:text-notion-muted-dark ml-2">{{ user.display_name }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span :class="user.role === 'admin' ? 'badge text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'badge text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'">
                {{ user.role === 'admin' ? '管理员' : '用户' }}
              </span>
              <span :class="user.is_active ? 'badge text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'badge text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'">
                {{ user.is_active ? '启用' : '禁用' }}
              </span>
              <span v-if="isLocked(user)" class="badge text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                已锁定
              </span>
              <span v-if="user.role !== 'admin' && user.restrictedCategories && user.restrictedCategories.length > 0" :class="['badge text-[10px]', user.restriction_mode === 'block' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400']">
                {{ user.restriction_mode === 'block' ? '禁' : '仅' }}{{ user.restrictedCategories.length }}类
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-notion-muted dark:text-notion-muted-dark">
              {{ user.last_login_at ? '登录: ' + formatDate(user.last_login_at) : '从未登录' }}
            </span>
            <div class="flex items-center gap-1">
              <button v-if="isLocked(user)" @click="unlockUser(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="解锁账号">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </button>
              <button @click="router.push(`/users/${user.id}/logs`)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="活动日志">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </button>
              <button @click="editUser(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-accent dark:hover:text-accent-dark hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="编辑">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button @click="showResetPassword(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="重置密码">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </button>
              <button v-if="user.username !== 'admin'" @click="toggleUserStatus(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" :title="user.is_active ? '禁用' : '启用'">
                <svg v-if="user.is_active" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button v-if="user.username !== 'admin'" @click="deleteUser(user)" class="p-1.5 text-notion-muted dark:text-notion-muted-dark hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="删除">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add User Modal -->
    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="closeAddModal">
        <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <div class="flex items-center justify-between p-6 border-b border-notion-border dark:border-notion-border-dark">
            <h3 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark">添加用户</h3>
            <button @click="closeAddModal" class="text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form @submit.prevent="handleAddUser" class="p-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">用户名 *</label>
              <input v-model="addForm.username" type="text" class="input-field" placeholder="3-20个字符" required />
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">密码 *</label>
              <input v-model="addForm.password" type="password" class="input-field" placeholder="至少6位" required />
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">显示名称</label>
              <input v-model="addForm.displayName" type="text" class="input-field" placeholder="可选" />
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">角色</label>
              <select v-model="addForm.role" class="select-field">
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <div v-if="addError" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm text-red-600 dark:text-red-400">{{ addError }}</p>
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="closeAddModal" class="btn-secondary">取消</button>
              <button type="submit" class="btn-primary" :disabled="addLoading">
                {{ addLoading ? '添加中...' : '添加' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Edit User Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="closeEditModal">
        <div class="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
          <div class="flex-shrink-0 flex items-center justify-between p-6 border-b border-notion-border dark:border-notion-border-dark sticky top-0 z-10 bg-white dark:bg-gray-800 rounded-t-xl">
            <h3 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark">编辑用户</h3>
            <button @click="closeEditModal" class="text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form @submit.prevent="handleEditUser" class="p-6 space-y-4 overflow-y-auto">
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">用户名</label>
              <input :value="editForm.username" type="text" class="input-field bg-gray-100 dark:bg-gray-700" disabled />
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">显示名称</label>
              <input v-model="editForm.displayName" type="text" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">角色</label>
              <select v-model="editForm.role" class="select-field" :disabled="editForm.username === 'admin'">
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </div>
            <!-- 分类限制（仅普通用户） -->
            <div v-if="editForm.role === 'user'">
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">题库分类限制</label>
              <div class="flex gap-3 mb-3">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="all" v-model="editRestrictionMode" class="accent-notion-accent dark:accent-notion-accent-dark" />
                  <span class="text-sm text-notion-text dark:text-notion-text-dark">全部分类</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="custom" v-model="editRestrictionMode" class="accent-notion-accent dark:accent-notion-accent-dark" />
                  <span class="text-sm text-notion-text dark:text-notion-text-dark">限制指定分类</span>
                </label>
              </div>
              <div v-if="editRestrictionMode === 'custom'">
                <!-- 模式切换 -->
                <div class="flex gap-1 mb-3 p-1 rounded-btn bg-gray-100 dark:bg-gray-700/50">
                  <button
                    type="button"
                    @click="restrictionPolicy = 'allow'"
                    :class="['flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors', restrictionPolicy === 'allow' ? 'bg-white dark:bg-gray-600 text-notion-accent dark:text-notion-accent-dark shadow-sm' : 'text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark']"
                  >仅允许</button>
                  <button
                    type="button"
                    @click="restrictionPolicy = 'block'"
                    :class="['flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors', restrictionPolicy === 'block' ? 'bg-white dark:bg-gray-600 text-red-600 dark:text-red-400 shadow-sm' : 'text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark']"
                  >禁止访问</button>
                </div>
                <!-- 已选分类标签 -->
                <div v-if="editForm.restrictedCategories.length > 0" :class="['flex flex-wrap gap-1.5 mb-2 p-2 rounded-btn border', restrictionPolicy === 'block' ? 'bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-800/30' : 'bg-notion-accent/5 dark:bg-notion-accent-dark/10 border-notion-accent/20 dark:border-notion-accent-dark/20']">
                  <span
                    v-for="name in editForm.restrictedCategories"
                    :key="name"
                    :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-badge text-xs', restrictionPolicy === 'block' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-notion-accent/15 dark:bg-notion-accent-dark/20 text-notion-accent dark:text-notion-accent-dark']"
                  >
                    {{ name }}
                    <button @click="toggleEditCategory(name)" class="hover:text-red-500 transition-colors">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </span>
                </div>
                <p v-else class="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  ⚠ 尚未选择任何分类{{ restrictionPolicy === 'allow' ? '，用户将无法刷题' : '，用户可访问所有分类' }}
                </p>
                <div class="relative mb-2">
                  <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-notion-muted dark:text-notion-muted-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    v-model="categorySearch"
                    type="text"
                    class="w-full pl-8 pr-3 py-1.5 text-xs rounded-btn border border-notion-border dark:border-notion-border-dark bg-notion-bg dark:bg-notion-bg-dark text-notion-text dark:text-notion-text-dark focus:outline-none focus:border-notion-accent dark:focus:border-notion-accent-dark"
                    placeholder="搜索分类..."
                  />
                </div>
                <div class="max-h-40 overflow-y-auto border border-notion-border dark:border-notion-border-dark rounded-lg p-2.5 space-y-1.5">
                  <label
                    v-for="cat in filteredCategories"
                    :key="cat.id"
                    class="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <input
                      type="checkbox"
                      :checked="editForm.restrictedCategories.includes(cat.name)"
                      @change="toggleEditCategory(cat.name)"
                      class="accent-notion-accent dark:accent-notion-accent-dark"
                    />
                    <span class="text-sm text-notion-text dark:text-notion-text-dark">{{ cat.name }}</span>
                    <span class="text-xs text-notion-muted dark:text-notion-muted-dark">({{ cat.question_count }}题)</span>
                  </label>
                  <p v-if="filteredCategories.length === 0" class="text-xs text-notion-muted dark:text-notion-muted-dark px-2">
                    {{ categorySearch ? '无匹配分类' : '暂无分类' }}
                  </p>
                </div>
              </div>
              <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-1.5">
                <template v-if="editRestrictionMode === 'all'">用户可访问所有分类的题库</template>
                <template v-else-if="restrictionPolicy === 'allow'">
                  已选 <span class="font-medium text-notion-accent dark:text-notion-accent-dark">{{ editForm.restrictedCategories.length }}</span> 个分类，用户只能访问这些分类
                </template>
                <template v-else>
                  已选 <span class="font-medium text-red-600 dark:text-red-400">{{ editForm.restrictedCategories.length }}</span> 个分类，用户不可访问这些分类
                </template>
              </p>
            </div>
            <!-- 允许使用管理员 AI -->
            <div class="flex items-center justify-between py-3 border-t border-notion-border dark:border-notion-border-dark">
              <div>
                <p class="text-sm font-medium text-notion-text dark:text-notion-text-dark">允许使用管理员 AI</p>
                <p class="text-xs text-notion-muted dark:text-notion-muted-dark mt-0.5">开启后用户可使用管理员配置的 AI 模型</p>
              </div>
              <button
                type="button"
                @click="editForm.canUseAdminAi = !editForm.canUseAdminAi"
                :class="[
                  'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                  editForm.canUseAdminAi ? 'bg-notion-accent dark:bg-notion-accent-dark' : 'bg-gray-200 dark:bg-gray-700'
                ]"
              >
                <span
                  :class="[
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    editForm.canUseAdminAi ? 'translate-x-5' : 'translate-x-0'
                  ]"
                />
              </button>
            </div>
            <div v-if="editError" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm text-red-600 dark:text-red-400">{{ editError }}</p>
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="closeEditModal" class="btn-secondary">取消</button>
              <button type="submit" class="btn-primary" :disabled="editLoading">
                {{ editLoading ? '保存中...' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Reset Password Modal -->
    <Teleport to="body">
      <div v-if="showResetModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" @click.self="closeResetModal">
        <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
          <div class="flex items-center justify-between p-6 border-b border-notion-border dark:border-notion-border-dark">
            <h3 class="text-lg font-semibold text-notion-text dark:text-notion-text-dark">重置密码</h3>
            <button @click="closeResetModal" class="text-notion-muted dark:text-notion-muted-dark hover:text-notion-text dark:hover:text-notion-text-dark">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form @submit.prevent="handleResetPassword" class="p-6 space-y-4">
            <p class="text-sm text-notion-muted dark:text-notion-muted-dark">
              为用户 <span class="font-medium text-notion-text dark:text-notion-text-dark">{{ resetForm.username }}</span> 重置密码
            </p>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">新密码 *</label>
              <input v-model="resetForm.newPassword" type="password" class="input-field" placeholder="至少6位" required />
            </div>
            <div>
              <label class="block text-sm font-medium text-notion-text dark:text-notion-text-dark mb-2">确认密码 *</label>
              <input v-model="resetForm.confirmPassword" type="password" class="input-field" placeholder="再次输入新密码" required />
            </div>
            <div v-if="resetError" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm text-red-600 dark:text-red-400">{{ resetError }}</p>
            </div>
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" @click="closeResetModal" class="btn-secondary">取消</button>
              <button type="submit" class="btn-primary" :disabled="resetLoading">
                {{ resetLoading ? '重置中...' : '重置密码' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToastStore } from '../stores/toast'
import { useConfirmStore } from '../stores/confirm'

const router = useRouter()
const toastStore = useToastStore()
const confirmStore = useConfirmStore()

const users = ref([])
const loading = ref(false)
const categories = ref([])

// Add user
const showAddModal = ref(false)
const addLoading = ref(false)
const addError = ref('')
const addForm = ref({
  username: '',
  password: '',
  displayName: '',
  role: 'user',
  restrictedCategories: []
})

// Edit user
const showEditModal = ref(false)
const editLoading = ref(false)
const editError = ref('')
const editForm = ref({
  id: null,
  username: '',
  displayName: '',
  role: 'user',
  restrictedCategories: [],
  canUseAdminAi: false
})
const editRestrictionMode = ref('all') // 'all' | 'custom'
const restrictionPolicy = ref('allow') // 'allow' | 'block'
const categorySearch = ref('')

const filteredCategories = computed(() => {
  const q = categorySearch.value.trim().toLowerCase()
  if (!q) return categories.value
  return categories.value.filter(c => c.name.toLowerCase().includes(q))
})

// Reset password
const showResetModal = ref(false)
const resetLoading = ref(false)
const resetError = ref('')
const resetForm = ref({
  id: null,
  username: '',
  newPassword: '',
  confirmPassword: ''
})

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isLocked(user) {
  if (!user.locked_until) return false
  return new Date(user.locked_until) > new Date()
}

async function fetchUsers() {
  loading.value = true
  try {
    const res = await fetch('/api/users', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    if (res.ok) {
      users.value = await res.json()
    }
  } catch (err) {
    console.error('获取用户列表失败:', err)
  } finally {
    loading.value = false
  }
}

async function handleAddUser() {
  addLoading.value = true
  addError.value = ''

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        username: addForm.value.username,
        password: addForm.value.password,
        displayName: addForm.value.displayName || addForm.value.username,
        role: addForm.value.role
      })
    })

    const data = await res.json()

    if (!res.ok) {
      addError.value = data.error || '添加失败'
      return
    }

    toastStore.success('用户添加成功')
    closeAddModal()
    fetchUsers()
  } catch (err) {
    addError.value = '网络错误，请稍后重试'
  } finally {
    addLoading.value = false
  }
}

function closeAddModal() {
  showAddModal.value = false
  addForm.value = { username: '', password: '', displayName: '', role: 'user', restrictedCategories: [] }
  addError.value = ''
}

function editUser(user) {
  const restricted = user.restrictedCategories || []
  editForm.value = {
    id: user.id,
    username: user.username,
    displayName: user.display_name || '',
    role: user.role,
    restrictedCategories: [...restricted],
    canUseAdminAi: !!user.can_use_admin_ai
  }
  editRestrictionMode.value = restricted.length > 0 ? 'custom' : 'all'
  restrictionPolicy.value = user.restriction_mode || 'allow'
  showEditModal.value = true
}

async function handleEditUser() {
  editLoading.value = true
  editError.value = ''

  try {
    const res = await fetch(`/api/users/${editForm.value.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        displayName: editForm.value.displayName,
        role: editForm.value.role,
        restrictedCategories: editRestrictionMode.value === 'custom' ? editForm.value.restrictedCategories : [],
        restrictionMode: editRestrictionMode.value === 'custom' ? restrictionPolicy.value : 'allow',
        canUseAdminAi: editForm.value.canUseAdminAi
      })
    })

    const data = await res.json()

    if (!res.ok) {
      editError.value = data.error || '修改失败'
      return
    }

    toastStore.success('用户信息更新成功')
    closeEditModal()
    fetchUsers()
  } catch (err) {
    editError.value = '网络错误，请稍后重试'
  } finally {
    editLoading.value = false
  }
}

function closeEditModal() {
  showEditModal.value = false
  editForm.value = { id: null, username: '', displayName: '', role: 'user', restrictedCategories: [] }
  editRestrictionMode.value = 'all'
  restrictionPolicy.value = 'allow'
  categorySearch.value = ''
  editError.value = ''
}

function showResetPassword(user) {
  resetForm.value = {
    id: user.id,
    username: user.username,
    newPassword: ''
  }
  showResetModal.value = true
}

async function handleResetPassword() {
  resetLoading.value = true
  resetError.value = ''

  if (resetForm.value.newPassword !== resetForm.value.confirmPassword) {
    resetError.value = '两次输入的密码不一致'
    resetLoading.value = false
    return
  }

  try {
    const res = await fetch(`/api/users/${resetForm.value.id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        newPassword: resetForm.value.newPassword
      })
    })

    const data = await res.json()

    if (!res.ok) {
      resetError.value = data.error || '重置失败'
      return
    }

    toastStore.success('密码重置成功')
    closeResetModal()
  } catch (err) {
    resetError.value = '网络错误，请稍后重试'
  } finally {
    resetLoading.value = false
  }
}

function closeResetModal() {
  showResetModal.value = false
  resetForm.value = { id: null, username: '', newPassword: '', confirmPassword: '' }
  resetError.value = ''
}

async function toggleUserStatus(user) {
  const action = user.is_active ? '禁用' : '启用'
  const confirmed = await confirmStore.show({
    title: `${action}用户`,
    message: `确定要${action}用户 "${user.username}" 吗？`,
    confirmText: action,
    cancelText: '取消'
  })

  if (!confirmed) return

  try {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        isActive: !user.is_active
      })
    })

    if (res.ok) {
      toastStore.success(`用户已${action}`)
      fetchUsers()
    } else {
      const data = await res.json()
      toastStore.error(data.error || `${action}失败`)
    }
  } catch (err) {
    toastStore.error(`${action}失败: ${err.message}`)
  }
}

async function deleteUser(user) {
  const confirmed = await confirmStore.show({
    title: '删除用户',
    message: `确定要永久删除用户 "${user.username}" 吗？此操作不可撤销。`,
    confirmText: '删除',
    cancelText: '取消'
  })

  if (!confirmed) return

  try {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (res.ok) {
      toastStore.success('用户已删除')
      fetchUsers()
    } else {
      const data = await res.json()
      toastStore.error(data.error || '删除失败')
    }
  } catch (err) {
    toastStore.error(`删除失败: ${err.message}`)
  }
}

async function unlockUser(user) {
  const confirmed = await confirmStore.show({
    title: '解锁账号',
    message: `确定要解锁用户 "${user.username}" 吗？将清除失败登录记录。`,
    confirmText: '解锁',
    cancelText: '取消'
  })

  if (!confirmed) return

  try {
    const res = await fetch(`/api/users/${user.id}/unlock`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (res.ok) {
      toastStore.success('账号已解锁')
      fetchUsers()
    } else {
      const data = await res.json()
      toastStore.error(data.error || '解锁失败')
    }
  } catch (err) {
    toastStore.error(`解锁失败: ${err.message}`)
  }
}

async function fetchCategories() {
  try {
    const res = await fetch('/api/categories', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    if (res.ok) {
      categories.value = await res.json()
    }
  } catch {}
}

function toggleEditCategory(catName) {
  const idx = editForm.value.restrictedCategories.indexOf(catName)
  if (idx >= 0) {
    editForm.value.restrictedCategories.splice(idx, 1)
  } else {
    editForm.value.restrictedCategories.push(catName)
  }
}

onMounted(() => {
  fetchUsers()
  fetchCategories()
})
</script>
