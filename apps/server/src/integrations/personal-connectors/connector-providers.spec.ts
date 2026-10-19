import { connectorDocument, refreshConnector } from './connector-providers';

describe('connector provider requests',()=>{
  afterEach(()=>jest.restoreAllMocks());
  it('requests JSON when refreshing a short-lived GitHub token',async()=>{
    const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({access_token:'next-token',refresh_token:'next-refresh',expires_in:3600}),{status:200}));
    const result=await refreshConnector('github',{clientId:'id',clientSecret:'secret',accessToken:'old',refreshToken:'refresh',expiresAt:1});
    expect(result.accessToken).toBe('next-token');expect(fetch.mock.calls[0][1].headers).toMatchObject({Accept:'application/json'});
  });
  it('fetches the selected GitHub branch from the fixed API endpoint',async()=>{
    const fetch=jest.spyOn(global,'fetch').mockResolvedValue(new Response(JSON.stringify({type:'file',encoding:'base64',size:5,name:'README.md',content:Buffer.from('hello').toString('base64')}),{status:200}));
    expect(await connectorDocument('github','token','owner/repo/README.md?ref=feature%2Fbranch')).toEqual({title:'README.md',text:'hello'});
    expect(fetch.mock.calls[0][0]).toBe('https://api.github.com/repos/owner/repo/contents/README.md?ref=feature%2Fbranch');
  });
  it('rejects arbitrary URLs, traversal and extra query parameters before network access',async()=>{
    const fetch=jest.spyOn(global,'fetch');
    for(const source of ['https://evil.test/file.md','owner/repo/../file.md','owner/repo/file.md?ref=main&token=secret','owner/repo/file.md?foo=main'])await expect(connectorDocument('github','token',source)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
