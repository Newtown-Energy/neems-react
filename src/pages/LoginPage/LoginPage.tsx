import React, { useState } from "react";
import { Box, Button, TextField, Typography, Paper } from "@mui/material";
import type { LoginSuccessResponse } from "../../types/auth";
import { apiRequest, ApiError } from "../../utils/api";
import { debugLog } from "../../utils/debug";

type Props = { onLoginSuccess: (userInfo: LoginSuccessResponse) => void };

const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const requestBody = { email, password };
    console.log("Sending login request with body:", requestBody);
    debugLog('LoginPage: Login attempt', { email });

    try {
      const userInfo = await apiRequest<LoginSuccessResponse>("/api/1/login", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });
      debugLog('LoginPage: Login successful', {
        email: userInfo.email,
        roles: userInfo.roles,
        companyName: userInfo.company_name
      });
      localStorage.setItem('userEmail', email);
      onLoginSuccess(userInfo);
    } catch (error) {
      debugLog('LoginPage: Login failed', {
        email,
        error,
        status: error instanceof ApiError ? error.status : undefined
      });
      if (error instanceof ApiError) {
        setError(error.message);
      } else {
        setError("Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      id="login-box"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "url(/map-tint.gif)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}>
      <Paper sx={{ p: 4, width: 350 }}>
        <Typography variant="h5" gutterBottom>NEEMS Login</Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <Typography color="error" variant="body2">{error}</Typography>}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default LoginPage;
