<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const formRef = ref<FormInstance>();
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({
  email: '',
  password: '',
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
};

async function handleSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  errorMessage.value = '';
  try {
    await authStore.login(form.email, form.password);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.push(redirect);
  } catch {
    errorMessage.value = '登录失败，请检查邮箱和密码';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth-view">
    <h1 class="page-title">登录</h1>
    <p class="page-subtitle">登录后可设置偏好并获取个性化 Feed 排序</p>

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

        <el-form-item>
          <el-button type="primary" :loading="loading" native-type="submit">登录</el-button>
          <el-button link type="primary" @click="router.push('/register')">没有账号？去注册</el-button>
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
