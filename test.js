async function sand() {
    try{
        const response = await fetch(`http://localhost:4000/api/cart/item/1}`, {
            method: "PUT",
            headers: {
                "Content-Type":"application/json"
            },
            body: JSON.stringify({
                quantity: 1
            })
        });

        const data = await response.json();
        console.log(response);
        console.log(data);
    }
    catch(e){

    }
}

sand();