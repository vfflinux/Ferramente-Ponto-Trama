// [] Criar uma calculadora que recebe os respectivos valores:
//  Valor da linha;[x]
//  tempo gasto em horas;[x]
//  valor da mão de obra por hora;[x]
//  valor dos acessórios;[x]
//  e a porcentagem do lucro;[x]
//  e retorna o valor final, um do gasto do produto e outro o valor de venda do produto;[x]

//  Contador de Carreiras


const valorLinha = 24.99;
const tempoGastoH = 5;
const valorMaoDeObraH = 20.0;
const valorAcessorios = 10.0;
const porcentagemLucro = 50;
const custoProduto =
  valorLinha + tempoGastoH * valorMaoDeObraH + valorAcessorios;
const vFinalProduto = custoProduto + (custoProduto * porcentagemLucro) / 100;

console.log(
  ` Valor da linha: ${valorLinha}\n`,
  `Valor dos acessórios: ${valorAcessorios}\n`,
  `Valor da hora de mão de obra: ${valorMaoDeObraH}\n`,
  `Tempo gasto: ${tempoGastoH}\n\n`,
  `Valor de custo do produro: ${custoProduto}\n\n\n`,
  `Porcentagem de lucro: ${porcentagemLucro}%\n\n`,
  `Valor final/de venda do produto: ${vFinalProduto.toFixed(2)}`,
);

