
import { Navigate } from "react-router-dom";

const Index = () => {
  // In a real app, you would check authentication status here
  // For now, just navigate to the login page
  return <Navigate to="/login" replace />;
};

export default Index;
