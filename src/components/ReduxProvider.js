"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/store/store";

// Envuelve la app con el store de Redux. El inicializador perezoso de useState
// crea el store una sola vez por cliente y lo hidrata con `initialUser`, la
// sesión que el layout resolvió en el servidor, para que el navbar no parpadee.
export default function ReduxProvider({ initialUser = null, children }) {
  const [store] = useState(() => makeStore({ auth: { user: initialUser } }));

  return <Provider store={store}>{children}</Provider>;
}
