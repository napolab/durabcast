interface CfEnv {
  BROADCAST_MESSAGE: DurableObjectNamespace<import('../src/broadcast-message.do').BroadcastMessage>;
}

declare module 'cloudflare:test' {
  interface ProvidedEnv extends CfEnv {}
}
