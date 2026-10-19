import { PersonalConnectorsService } from './personal-connectors.service';
import { exchangeConnectorCode,connectorDocument,connectorChoices } from './connector-providers';
jest.mock('./connector-providers',()=>({...jest.requireActual('./connector-providers'),exchangeConnectorCode:jest.fn(),connectorDocument:jest.fn(),connectorChoices:jest.fn()}));
const owner={id:'11111111-1111-4111-8111-111111111111',role:'owner'} as any;
describe('Personal connector consent boundary',()=>{
  let service:PersonalConnectorsService,records:any;
  beforeEach(()=>{records={};jest.clearAllMocks();service=new PersonalConnectorsService({read:(id:string)=>structuredClone(records[id]||{}),write:(id:string,value:any)=>{records[id]=structuredClone(value);}} as any,{assertOwner:jest.fn()} as any,{getAppUrl:()=> 'https://example.test'} as any);});
  it('uses owner-bound, expiring state and S256, never exposing secrets',async()=>{
    await service.configure(owner,'github','client','secret');const result=await service.signIn(owner,'github'),url=new URL(result.url);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('redirect_uri')).toBe('https://example.test/api/personal-connectors/callback/github');
    expect(JSON.stringify(service.status(owner))).not.toContain('secret');
    await expect(service.callback(owner,'github','wrong','code')).rejects.toThrow();
    expect(exchangeConnectorCode).not.toHaveBeenCalled();
    (exchangeConnectorCode as jest.Mock).mockResolvedValue({access_token:'token'});
    await service.callback(owner,'github',url.searchParams.get('state'),'code');
    await expect(service.callback(owner,'github',url.searchParams.get('state'),'code')).rejects.toThrow();
    expect(exchangeConnectorCode).toHaveBeenCalledTimes(1);expect(JSON.stringify(service.status(owner))).not.toContain('token');
  });
  it('rejects expired/cross-owner state without provider requests',async()=>{
    await service.configure(owner,'notion','client','secret');const result=await service.signIn(owner,'notion'),state=new URL(result.url).searchParams.get('state');
    await expect(service.callback({...owner,id:'22222222-2222-4222-8222-222222222222'},'notion',state,'code')).rejects.toThrow();
    records[owner.id].notion.stateExpires=1;await expect(service.callback(owner,'notion',state,'code')).rejects.toThrow();expect(exchangeConnectorCode).not.toHaveBeenCalled();
  });
  it('clears prior authorization on client changes and disconnect, preserving configuration',async()=>{
    await service.configure(owner,'github','client','secret');records[owner.id].github.accessToken='token';
    await expect(service.configure(owner,'github','new-client')).rejects.toThrow('new Client ID');
    await service.configure(owner,'github','new-client','new-secret');await expect(service.preview(owner,'github','owner/repo/README.md')).rejects.toThrow();
    records[owner.id].github.accessToken='new-token';await service.disconnect(owner,'github');
    expect(records[owner.id].github).toMatchObject({clientId:'new-client',clientSecret:'new-secret'});expect(records[owner.id].github.accessToken).toBeUndefined();expect(connectorDocument).not.toHaveBeenCalled();
  });
  it('verifies actual source access and records success only after the provider responds',async()=>{
    await service.configure(owner,'github','client','secret');records[owner.id].github.accessToken='token';
    (connectorChoices as jest.Mock).mockRejectedValueOnce(new Error('Provider request failed (403)'));
    await expect(service.verify(owner,'github')).rejects.toThrow('403');expect(records[owner.id].github.verifiedAt).toBeUndefined();
    (connectorChoices as jest.Mock).mockResolvedValueOnce([{id:'owner/repo/README.md',name:'README'}]);
    const result=await service.verify(owner,'github');expect(result.sources).toHaveLength(1);expect(result.verifiedAt).toBe(records[owner.id].github.verifiedAt);
    expect(connectorChoices).toHaveBeenLastCalledWith('github','token','');expect(JSON.stringify(service.status(owner))).not.toContain('token');
  });
  it('keeps a valid connection and verification when saving unchanged settings',async()=>{
    await service.configure(owner,'github','client','secret');records[owner.id].github.accessToken='token';records[owner.id].github.verifiedAt='2026-10-16T00:00:00.000Z';
    await service.configure(owner,'github','client');expect(records[owner.id].github.accessToken).toBe('token');expect(records[owner.id].github.verifiedAt).toBe('2026-10-16T00:00:00.000Z');
  });
});
