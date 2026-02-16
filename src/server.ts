<script>

function gerarPix() {

    const btn = document.getElementById("btn_pagar");
    btn.innerHTML = "PROCESSANDO...";
    btn.disabled = true;

    fetch("https://checkout-pix-profissional.onrender.com/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: "27.90" })
    })
    .then(res => res.json())
    .then(data => {

        console.log("RESPOSTA PIX:", data);

        if (!data.success) throw new Error("Falha ao gerar PIX");

        abrirModal(data);

        // ✅ Só verifica se backend mandar paymentId
        if (data.paymentId) {
            verificarPagamento(data.paymentId, btn);
        } else {
            console.warn("⚠️ paymentId não veio do backend");
            liberarBotao(btn);
        }

    })
    .catch(err => {
        console.error("ERRO PIX:", err);
        alert("Erro ao gerar pagamento");
        liberarBotao(btn);
    });
}

function abrirModal(data) {

    overlay.style.display = "block";
    modal_pix.style.display = "block";

    txt_codigo.value = data.payload;

    qr_code_div.innerHTML = "";

    if (data.encodedImage) {

        const src = data.encodedImage.startsWith("http")
            ? data.encodedImage
            : `data:image/png;base64,${data.encodedImage}`;

        qr_code_div.innerHTML = `<img src="${src}">`;

    } else {

        new QRCode(qr_code_div, {
            text: data.payload,
            width: 200,
            height: 200
        });
    }
}

function verificarPagamento(paymentId, btn) {

    console.log("🔎 Verificando pagamento:", paymentId);

    const intervalo = setInterval(() => {

        fetch(`https://checkout-pix-profissional.onrender.com/status/${paymentId}`)
        .then(res => res.json())
        .then(data => {

            console.log("STATUS:", data);

            if (data.status === "approved" || data.status === "paid") {

                clearInterval(intervalo);

                fecharModal();
                liberarBotao(btn);

                alert("✅ Pagamento confirmado");

            }

        })
        .catch(err => {
            console.error("ERRO STATUS:", err);
            clearInterval(intervalo);
            liberarBotao(btn);
        });

    }, 3000);
}

function fecharModal() {
    overlay.style.display = "none";
    modal_pix.style.display = "none";
    qr_code_div.innerHTML = "";
    txt_codigo.value = "";
}

function liberarBotao(btn) {
    btn.innerHTML = "RESGATAR R$ 1.342,03";
    btn.disabled = false;
}

function copiarCodigo() {
    txt_codigo.select();
    navigator.clipboard.writeText(txt_codigo.value);
    alert("Código PIX copiado!");
}

</script>
