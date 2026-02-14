import { useState } from "react";
import api from "../configs/axios";
import toast from "react-hot-toast";
import { useAuth } from "@clerk/clerk-react";

export function useCredits() {
  const [credits, setCredits] = useState(0);
  const { getToken } = useAuth();

  const fetchCredits = async () => {
    try {
      const token = await getToken();
      const { data } = await api.get("/api/user/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCredits(data.credits);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message);
    }
  };

  return { credits, fetchCredits, setCredits };
}
