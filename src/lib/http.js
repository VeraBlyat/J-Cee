import axios from "axios";
import { API_URL } from "./apiBase";

// Cliente Axios central para el NAVEGADOR (componentes de cliente, thunks de
// Redux). Reemplaza a los fetch(..., { credentials: "include" }) sueltos:
//   - baseURL fija en la API del backend (misma que usaba API_URL).
//   - withCredentials manda siempre la cookie de sesión, como hacía
//     `credentials: "include"`.
const http = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export default http;
