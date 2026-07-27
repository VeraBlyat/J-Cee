import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import http from "@/lib/http";

// Estado global de la sesión: el usuario actual vive acá y cualquier
// componente de cliente lo lee con useSelector en vez de re-pedirlo.

// Extrae el mensaje de error que manda el backend Nest ({ error: "..." })
// desde un error de Axios, con un fallback razonable.
function errorMessage(err, fallback) {
  return err.response?.data?.error || fallback;
}

export const login = createAsyncThunk(
  "auth/login",
  async ({ username, password }, { rejectWithValue }) => {
    try {
      await http.post("/auth/login", { username, password });
      const { data } = await http.get("/auth/me");
      return data;
    } catch (err) {
      return rejectWithValue(errorMessage(err, "Ocurrió un error."));
    }
  }
);

export const register = createAsyncThunk(
  "auth/register",
  async ({ username, password }, { rejectWithValue }) => {
    try {
      await http.post("/auth/register", { username, password });
      const { data } = await http.get("/auth/me");
      return data;
    } catch (err) {
      return rejectWithValue(errorMessage(err, "Ocurrió un error."));
    }
  }
);

export const logout = createAsyncThunk("auth/logout", async () => {
  await http.post("/auth/logout");
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null, // usuario actual o null si no hay sesión
  },
  reducers: {
    // Permite hidratar el store con el usuario resuelto en el servidor.
    setUser(state, action) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
      });
  },
});

export const { setUser } = authSlice.actions;
export default authSlice.reducer;
