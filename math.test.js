const { calculateDiscount } = require('./math');

test('should correctly apply discount', () => {
    expect(calculateDiscount(100, 20)).toBe(80);
});

test('should return original price if discount is negative', () => {
    expect(calculateDiscount(100, -5)).toBe(100);
});
