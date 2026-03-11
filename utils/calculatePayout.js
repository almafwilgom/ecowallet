export const calculatePayout = (material, weight, state) => {
  const north = ["Kano","Kaduna","Plateau","Bauchi","Borno","Yobe"];
  const south = ["Lagos","Ogun","Rivers","Delta","Anambra"];

  const prices = {
    PET: north.includes(state) ? 400 : 480,
    HDPE: north.includes(state) ? 330 : 420,
    Aluminum: north.includes(state) ? 1000 : 1200
  };

  return prices[material] * weight;
};