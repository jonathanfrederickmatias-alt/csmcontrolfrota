import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import EquipmentPage from "@/pages/EquipmentPage";
import ChecklistPage from "@/pages/ChecklistPage";
import MaintenancePage from "@/pages/MaintenancePage";
import FuelPage from "@/pages/FuelPage";
import QRCodePage from "@/pages/QRCodePage";
import MaintenanceRequestPage from "@/pages/MaintenanceRequestPage";
import QRChecklist from "@/pages/qr/QRChecklist";
import QRFuel from "@/pages/qr/QRFuel";
import QRMaintenanceRequest from "@/pages/qr/QRMaintenanceRequest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public QR routes - no sidebar */}
          <Route path="/qr/checklist" element={<QRChecklist />} />
          <Route path="/qr/abastecimento" element={<QRFuel />} />
          <Route path="/qr/pedido-manutencao" element={<QRMaintenanceRequest />} />

          {/* Main app with sidebar */}
          <Route path="/*" element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/equipamentos" element={<EquipmentPage />} />
                <Route path="/checklist" element={<ChecklistPage />} />
                <Route path="/manutencao" element={<MaintenancePage />} />
                <Route path="/abastecimento" element={<FuelPage />} />
                <Route path="/qrcode" element={<QRCodePage />} />
                <Route path="/pedido-manutencao" element={<MaintenanceRequestPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
