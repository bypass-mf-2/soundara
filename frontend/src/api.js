const BASE_URL = import.meta.env.PROD
  ? "https://soundara.co/api"
  : "http://localhost:8001";

export default BASE_URL;