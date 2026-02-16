<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pagamento PIX</title>

<style>
body{
  font-family: Arial, Helvetica, sans-serif;
  background:#f5f5f5;
  display:flex;
  justify-content:center;
  align-items:center;
  height:100vh;
}

.box{
  background:#fff;
  padding:25px;
  border-radius:12px;
  width:350px;
  text-align:center;
  box-shadow:0 0 15px rgba(0,0,0,0.08);
}

button{
  background:#00a650;
  color:#fff;
  border:none;
  padding:15px;
  width:100%;
  border-radius:8px;
  font-size:16px;
  cursor:pointer;
}

button:disabled{
  background:#ccc;
}

#qrcode{
  width:230px;
  margin:20px auto;
  display:none;
}

#pixCode{
  font-size:12px;
  word-break:break-all;
  background:#f1f1f1;
  padding:10px;
  border-radius:8px;
  margin-top:10px;
  display:none;
}

#liberar{
  margin-top:15px;
  display:none;
  background:#007bff;
}
</style>
</head>

<body>

<div class="box">

<h3>🔐 Pagamento via PIX</h3>

<button onclick="gerarPix()" id="gerarBtn">
Gerar PIX
</button>

<img id="qrcode">

<div id="pixCode"></div>

<button id="liberar" onclick="redirecionar()">
RESGATAR AGORA
</button>

</div>

<script>

const API = "https://SEUAPP.onrender.com"

let transactionId = null

async function gerarPix(){

document.getElementById("gerarBtn").disabled = true

const response = await fetch(API + "/pix",{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({
name:"Cliente",
email:"cliente@email.com",
cpf:"00000000000",
phone:"11999999999",
valor:79.10
})
})

const data = await response.json()

if(data.success){

transactionId = data.transactionId

document.getElementById("qrcode").src = data.encodedImage
document.getElementById("qrcode").style.display = "block"

const pixCode = document.getElementById("pixCode")
pixCode.innerText = data.payload
pixCode.style.display = "block"

pixCode.onclick = () => {
navigator.clipboard.writeText(data.payload)
pixCode.innerText = "✅ Copiado!"
}

verificarPagamento()

}
}

// 🔄 polling
async function verificarPagamento(){

const interval = setInterval(async()=>{

const res = await fetch(API + "/check-status/" + transactionId)
const data = await res.json()

if(data.paid){

clearInterval(interval)

document.getElementById("qrcode").style.display = "none"
document.getElementById("pixCode").style.display = "none"

document.getElementById("liberar").style.display = "block"

setTimeout(()=>{
redirecionar()
},3000)

}

},3000)

}

function redirecionar(){
window.location.href = "https://recuperabonushopp.com/elementor-1064"
}

</script>

</body>
</html>
