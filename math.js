function calculateDiscount(price, discount) {
    if (discount < 0) return price;
    return price - discount;
}
module.exports = { calculateDiscount };
