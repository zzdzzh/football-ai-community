<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({
  email: '',
  password: '',
  nickname: '',
});

const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少 8 位', trigger: 'blur' },
  ],
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { min: 2, max: 32, message: '昵称长度 2-32 字符', trigger: 'blur' },
  ],
};

async function handleSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  errorMessage.value = '';
  try {
    await authStore.register(form.email, form.password, form.nickname);
    router.push('/settings/preferences');
  } catch {
    errorMessage.value = '注册失败，邮箱可能已被使用';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth-view">
    <h1 class="page-title">注册</h1>
    <p class="page-subtitle">创建账户，开始个性化你的足球社区体验</p>

    <el-card class="auth-card" shadow="never">
      <el-alert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
        class="auth-alert"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="you@example.com" />
        </el-form-item>

        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 8 位" />
        </el-form-item>

        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="2-32 个字符" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="loading" native-type="submit">注册</el-button>
          <el-button link type="primary" @click="router.push('/login')">已有账号？去登录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </section>
</template>

<style scoped>
.auth-view {
  max-width: 480px;
}

.auth-card {
  margin-top: 1rem;
}

.auth-alert {
  margin-bottom: 1rem;
}
</style>
