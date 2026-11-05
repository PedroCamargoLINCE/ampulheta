/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço da função da consulta por número (consulta/); vazio = consulta desligada. */
  readonly VITE_CONSULTA_URL?: string;
}
