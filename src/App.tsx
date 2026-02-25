import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import EquipmentPage from "@/pages/EquipmentPage";
import ChecklistPage from "@/pages/ChecklistPage";
import MaintenancePage from "@/pages/MaintenancePage";
import FuelPage from "@/pages/FuelPage";
import FuelSupplyPage from "@/pages/FuelSupplyPage";
import ReportsPage from "@/pages/ReportsPage";
import QRCodePage from "@/pages/QRCodePage";
import MaintenanceRequestPage from "@/pages/MaintenanceRequestPage";
import ObrasPage from "@/pages/ObrasPage";
import UsersPage from "@/pages/UsersPage";
import QRChecklist from "@/pages/qr/QRChecklist";
import QRFuel from "@/pages/qr/QRFuel";
import QRMaintenanceRequest from "@/pages/qr/QRMaintenanceRequest";
import QREquipamento from "@/pages/qr/QREquipamento";
import QRMechanicOS from "@/pages/qr/QRMechanicOS";
import QRPrintPage from "@/pages/QRPrintPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public QR routes - no login required */}
            <Route path="/qr/equipamento/:id" element={<QREquipamento />} />
            <Route path="/qr/checklist" element={<QRChecklist />} />
            <Route path="/qr/abastecimento" element={<QRFuel />} />
            <Route path="/qr/pedido-manutencao" element={<QRMaintenanceRequest />} />
            <Route path="/qr/mecanico" element={<QRMechanicOS />} />
            <Route path="/qr/imprimir" element={<QRPrintPage />} />

            {/* Protected app routes */}
            <Route path="/*" element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/equipamentos" element={<EquipmentPage />} />
                    <Route path="/checklist" element={<ChecklistPage />} />
                    <Route path="/manutencao" element={<MaintenancePage />} />
                    <Route path="/abastecimento" element={<FuelPage />} />
                    <Route path="/reabastecimento" element={<FuelSupplyPage />} />
                    <Route path="/relatorios" element={<ReportsPage />} />
                    <Route path="/qrcode" element={<QRCodePage />} />
                    <Route path="/pedido-manutencao" element={<MaintenanceRequestPage />} />
                    <Route path="/obras" element={<ObrasPage />} />
                    <Route path="/usuarios" element={<UsersPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
