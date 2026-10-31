import { createContext, useContext } from "react";

export const ServicesContext = createContext(null);
export const useServices = () => useContext(ServicesContext);
