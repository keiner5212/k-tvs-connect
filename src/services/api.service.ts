import axios, { AxiosError, AxiosInstance } from 'axios';

import { envs } from '@config/envs';
import { ApiProblem } from '@typings/types';

export const apiClient: AxiosInstance = axios.create({
  baseURL: envs.apiBaseUrl,
  timeout: envs.requestTimeoutMs,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export const toApiProblem = (error: unknown): ApiProblem => {
  const axiosError = error as AxiosError<{ code?: string; message?: string }>;
  const status = axiosError?.response?.status ?? 0;
  const data = axiosError?.response?.data;

  return {
    status,
    code: data?.code ?? 'network_error',
    message: data?.message ?? axiosError?.message ?? 'request failed',
  };
};
