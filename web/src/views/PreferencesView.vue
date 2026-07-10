<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { FormInstance } from 'element-plus';
import { fetchPreferences, updatePreferences } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import type { UserPreference } from '@/types/auth';

import { LEAGUE_OPTIONS } from '@/constants/leagues';

const authStore = useAuthStore();
const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const teamInput = ref('');

const leagueOptions = LEAGUE_OPTIONS;

const agentOptions = [
  { value: 'news', label: '新闻 Agent' },
  { value: 'stats', label: '数据 Agent' },
  { value: 'scout', label: '球探 Agent' },
  { value: 'tactical', label: '战术 Agent' },
  { value: 'fan', label: '球迷 Agent' },
  { value: 'content', label: '内容 Agent' },
];

const form = reactive<UserPreference>({
  followedTeams: [],
  followedLeagues: [],
  enabledAgents: ['news'],
  notifyMatchReport: true,
});

async function loadPreferences() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await fetchPreferences();
    form.followedTeams = [...data.followedTeams];
    form.followedLeagues = [...data.followedLeagues];
    form.enabledAgents = [...data.enabledAgents];
    form.notifyMatchReport = data.notifyMatchReport ?? true;
  } catch {
    errorMessage.value = '加载偏好失败，请重新登录后再试';
  } finally {
    loading.value = false;
  }
}

function addTeam() {
  const value = teamInput.value.trim();
  if (!value || form.followedTeams.includes(value)) return;
  form.followedTeams.push(value);
  teamInput.value = '';
}

function removeTeam(team: string) {
  form.followedTeams = form.followedTeams.filter((item) => item !== team);
}

async function handleSave() {
  if (!formRef.value) return;
  if (form.enabledAgents.length === 0) {
    errorMessage.value = '至少启用一个 Agent';
    return;
  }

  saving.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    await updatePreferences({
      followedTeams: form.followedTeams,
      followedLeagues: form.followedLeagues,
      enabledAgents: form.enabledAgents,
      notifyMatchReport: form.notifyMatchReport,
    });
    successMessage.value = '偏好已保存，返回首页查看排序效果';
  } catch {
    errorMessage.value = '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push({ path: '/login', query: { redirect: '/settings/preferences' } });
    return;
  }
  await loadPreferences();
});
</script>

<template>
  <section class="preferences-view">
    <h1 class="page-title">偏好设置</h1>
    <p class="page-subtitle">设置关注球队、联赛与 Agent，首页动态将按偏好加权排序</p>

    <el-skeleton v-if="loading" :rows="5" animated />

    <template v-else>
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
        class="prefs-alert"
      />
      <el-alert
        v-if="successMessage"
        :title="successMessage"
        type="success"
        show-icon
        :closable="false"
        class="prefs-alert"
      />

      <el-form ref="formRef" label-position="top" class="prefs-form" @submit.prevent="handleSave">
        <el-card shadow="never" class="prefs-card">
          <el-form-item label="关注球队">
            <div class="team-editor">
              <el-input
                v-model="teamInput"
                placeholder="输入球队名称后回车添加"
                @keyup.enter="addTeam"
              />
              <el-button type="primary" plain @click="addTeam">添加</el-button>
            </div>
            <div class="tag-list">
              <el-tag
                v-for="team in form.followedTeams"
                :key="team"
                closable
                @close="removeTeam(team)"
              >
                {{ team }}
              </el-tag>
              <span v-if="form.followedTeams.length === 0" class="empty-hint">暂未添加球队</span>
            </div>
          </el-form-item>
        </el-card>

        <el-card shadow="never" class="prefs-card">
          <el-form-item label="关注联赛">
            <el-checkbox-group v-model="form.followedLeagues" class="checkbox-grid">
              <el-checkbox
                v-for="league in leagueOptions"
                :key="league.value"
                :label="league.value"
              >
                {{ league.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-card>

        <el-card shadow="never" class="prefs-card">
          <el-form-item label="启用的 Agent">
            <el-checkbox-group v-model="form.enabledAgents" class="checkbox-grid">
              <el-checkbox
                v-for="agent in agentOptions"
                :key="agent.value"
                :label="agent.value"
              >
                {{ agent.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-card>

        <el-card shadow="never" class="prefs-card">
          <el-form-item label="赛后报道通知（预留）">
            <el-switch v-model="form.notifyMatchReport" />
          </el-form-item>
        </el-card>

        <div class="prefs-actions">
          <el-button type="primary" :loading="saving" native-type="submit">保存偏好</el-button>
          <el-button @click="router.push('/')">返回首页</el-button>
        </div>
      </el-form>
    </template>
  </section>
</template>

<style scoped>
.preferences-view {
  max-width: 720px;
}

.prefs-alert {
  margin-bottom: 1rem;
}

.prefs-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.prefs-card {
  width: 100%;
}

.team-editor {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.team-editor .el-input {
  flex: 1;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.empty-hint {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.25rem 0.75rem;
  width: 100%;
}

.prefs-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
</style>
