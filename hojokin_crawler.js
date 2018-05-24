var Nightmare = require('nightmare')
var nightmare = Nightmare({
    show: false
});

const base_url = 'https://it-hojo.secure.force.com/productsearchH29/Adopted_ITTool_Search_H29_Page';
const tmp_detail_urls = [];

const data = [
    [
        'ITツール名',
        'ITツール概要',
        '製品URL',
        '利用形態',
        '販売実勢価格帯',
        '導入１年目のランニングコスト',
        '導入から２年目以降のランニングコスト',
        '業種',
        '機能',
        'ホームページの詳細機能',
        '導入した会社数',
        '法人名・幹事社名'
    ]
];

var fs = require('fs');
var formatCSV = '';

// 検索ボタンをクリック
const start = (n, industory, tag) => {
    return new Promise((resolve, reject) => {
        n
            .goto(base_url)
            .select('select[name="page:form:compatibleIndustry"]', industory)
            .wait('#funcDiv')
            .check(`input[value=${tag}]`)
            .click('#searchButton')
            .evaluate(function () {

            })
            .then(function () {
                resolve();
            })
            .catch(function (error) {
                console.error('Search failed:', error);
                reject();
            });
    });
};

// 機能一覧取得
const find_tags = (n, industory) => {
    return new Promise((resolve, reject) => {
        n
            .goto(base_url)
            .select('select[name="page:form:compatibleIndustry"]', industory)
            .wait('#funcDiv')
            .evaluate(function () {
                const tags = [];
                document.querySelectorAll('#funcBody input').forEach(input => tags.push(input.value));
                return tags;
            })
            .then((value) => {
                return resolve(value);
            })
    })
};

// 業種一覧取得
const find_industries = n => {
    return new Promise((resolve, reject) => {
        n
            .goto(base_url)
            .wait('#funcDiv')
            .evaluate(function () {
                const industries = [];
                document.querySelectorAll('select[name="page:form:compatibleIndustry"] option').forEach(v => {
                    if (v.value != '') {
                        industries.push(v.value);
                    }
                });
                return industries;
            })
            .then(value => {
                return resolve(value)
            })
    });
};

// 詳細ページurl取得
var get_detail_urls = n => {
    return new Promise((resolve, reject) => {
        n
            .wait(1000)
            .evaluate(function() {
                const nodes = document.querySelectorAll('a.c-btn');
                const onclicks = [...nodes].map(node => node.getAttribute('onclick'));
                var this_detail_urls = []
                for (let i = 0; i < onclicks.length; i++) {
                    const params = onclicks[i].match(/'.*'/)[0].split(',');
                    const id   = params[0].replace(/'/g,'');
                    const gmid = params[1].replace(/'/g,'');

                    const this_detail_url = 'https://it-hojo.secure.force.com/productsearchH29/apex/Ag_ITToolDetails_H29_Page' + '?id=' + id + '&gmid=' + gmid;
                    this_detail_urls.push(this_detail_url)
                }
                return this_detail_urls;
            })
            .then(value => {
                for (let i = 0; i < value.length; i++) {
                    tmp_detail_urls.push(value[i])
                }

                return resolve(value);
            })
            .catch(function (error) {
                console.error('Search detail url failed:', error);
                reject();
            });
    });
};

// 次のページがあるかチェック
var check_exist_next_page = n => {
    return new Promise((resolve, reject) => {
        n
            .evaluate(function () {
                const exist_next_button = Boolean(document.querySelectorAll('button.c-txt-btn:not(.c-txt-btn--left)')[0]);

                return exist_next_button;
            })
            .then(value => {
                return resolve(value);
            })
    });
};

// 次へ進む（２ページ目以降）
var goto_next_page = n => {
    return new Promise((resolve, reject) => {
        n
            .click('button.c-txt-btn:not(.c-txt-btn--left)')
            .wait(1000)
            .evaluate(function () {

            })
            .then(value => {
                return resolve();
            })
            .catch(function(error) {
                console.error('Transition failed:', error);
                reject();
            });
    });
};

// 詳細URLから詳細データを取得
const fetch_detail_data = (n, url) => {
    return new Promise((resolve, reject) => {
        n
            .goto(url)
            .wait('table.search-popup-table')
            .evaluate(function () {
                return [...document.querySelectorAll('td')].map(node => node.innerText);
            })
            .then((value) => {
                return resolve(value);
            })
            .catch(function (error) {
                console.error('Fetch detail failed:', error);
                reject();
            });
    })
}

// 詳細ページURLの取得とページ遷移
async function fetchURLAndGoNextPage(nightmare) {
    await get_detail_urls(nightmare);
    console.log('detailUrls: ', tmp_detail_urls);
    const exist_next_page = await check_exist_next_page(nightmare);
    if (exist_next_page) {
        await goto_next_page(nightmare)
        console.log('next page');

        return true;
    } else {
        console.log('last page');

        return false;
    }
}

// 詳細ページURLを取得
async function fetchDetailUrls(nightmare) {
    while (await fetchURLAndGoNextPage(nightmare)) { }
}

// データを作成し、CSVに出力
async function createDetailRowData(nightmare) {
    // URLの重複削除
    const detail_urls = tmp_detail_urls.filter(function (x, i, self) {
        return self.indexOf(x) === i;
    });

    for (let i = 0; i < detail_urls.length; i++) {
        const row = await fetch_detail_data(nightmare, detail_urls[i]);
        data.push(row);
    }
    exportCSV(data);
}

// 配列をcsvで保存する関数
function exportCSV(content){
    for (var i = 0; i < content.length; i++) {
        var value = content[i];

        for (var j = 0; j < value.length; j++) { var innerValue = value[j]===null?'':value[j].toString(); var result = innerValue.replace(/"/g, '""'); if (result.search(/("|,|\n)/g) >= 0)
            result = '"' + result + '"';
            if (j > 0)
                formatCSV += ',';
            formatCSV += result;
        }
        formatCSV += '\n';
    }
    fs.writeFile('formList.csv', formatCSV, 'utf8', function (err) {
        if (err) {
            console.log('error');
        } else {
            console.log('success!');
        }
    });
}

// メイン処理
find_industries(nightmare).then(async (industries) => {
    console.log('industries:', industries);
    // 全ての詳細ページURLを取得する
    for (let is = 0; is < industries.length; is++) {
        const tags = await find_tags(nightmare, industries[is]);
        console.log('industry ', industries[is]);
        console.log('tags ', tags);
        for (let i = 0; i < tags.length; i++) {
            await start(nightmare, industries[is], tags[i]);
            await fetchDetailUrls(nightmare);
        }
    };

    await createDetailRowData(nightmare);
});