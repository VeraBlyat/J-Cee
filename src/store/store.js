import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";

// Fábrica de store: se crea uno por request/cliente (importante en Next para
// no compartir estado entre usuarios en el servidor). `preloadedState` permite
// hidratar el store con datos ya resueltos en el servidor (p. ej. la sesión).
export function makeStore(preloadedState) {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState,
  });
}
