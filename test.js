async function sand() {
    const response = await fetch("http://localhost:4000/api/cart/item", {
        method: "POST",
        headers: {
            "Content-Type":"application/json"
        },
        body: JSON.stringify({
            cartId: 7,
            productId: 2,
            quantity:1
        })
    });

    const data = await response.json();

    console.log(data);
}

sand();