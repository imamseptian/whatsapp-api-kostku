// const phoneNumberFormatter = (number) => {
//   // Menghilangkan karakter selain angka
//   let formatted = number.replace(/\D/g, "");

//   //   Menghilangkan awalan 0  dan replace jadi 62
//   if (formatted.startWith("0")) {
//     formatted = "62" + formatted.substr(1);
//   }

//   if (formatted.endsWith("@c.us")) {
//     formatted += "@c.us";
//   }

//   return formatted;
// };
const phoneNumberFormatter = (number) => {
  // Menghilangkan karakter selain angka
  let formatted = number.replace(/\D/g, "");

  //   Menghilangkan awalan 0  dan replace jadi 62
  if (formatted.startsWith("0")) {
    formatted = "62" + formatted.substr(1);
  }

  if (!formatted.endsWith("@c.us")) {
    formatted += "@c.us";
  }

  return formatted;
};

module.exports = {
  phoneNumberFormatter,
};
